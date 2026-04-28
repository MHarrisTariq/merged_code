"""
Smart Pricing - Car Rental ML Training Pipeline
================================================
Target variable : price (daily rental price)
Approach        : XGBoost + LightGBM (side-by-side), best model saved
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.ensemble import HistGradientBoostingRegressor
import xgboost as xgb
import lightgbm as lgb
import joblib
import warnings
from pathlib import Path
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# 1. LOAD DATA
# ─────────────────────────────────────────────
def load_data(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    print(f"Loaded {len(df):,} rows x {df.shape[1]} columns")
    return df


# ─────────────────────────────────────────────
# 1b. STRICT CLEANING (optional)
# ─────────────────────────────────────────────
def strict_clean_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Strict cleaning to remove rows that are invalid/noisy and harm model accuracy.
    This is intentionally conservative and prints what it removes.
    """
    df = df.copy()
    n0 = len(df)

    removed = {}

    # Price must be numeric and > 0
    price_num = pd.to_numeric(df.get("price"), errors="coerce")
    mask_price = price_num.notna() & (price_num > 0)
    removed["invalid_price"] = int((~mask_price).sum())
    df = df.loc[mask_price].copy()
    df["price"] = price_num.loc[mask_price].astype(float)

    # Required categorical keys (must exist, not empty)
    for col in ["city", "group", "country", "airport_iata"]:
        if col in df.columns:
            m = df[col].astype(str).str.strip().ne("") & df[col].notna()
            removed[f"missing_{col}"] = int((~m).sum())
            df = df.loc[m].copy()

    # Dates must parse
    for col in ["start_date", "return_date"]:
        if col in df.columns:
            d = pd.to_datetime(df[col], errors="coerce")
            m = d.notna()
            removed[f"invalid_{col}"] = int((~m).sum())
            df = df.loc[m].copy()

    # Rental length must be numeric and >= 1
    if "rental_length" in df.columns:
        rl = pd.to_numeric(df["rental_length"], errors="coerce")
        m = rl.notna() & (rl >= 1)
        removed["invalid_rental_length"] = int((~m).sum())
        df = df.loc[m].copy()
        df["rental_length"] = rl.loc[m].astype(int)

    # Remove extreme outliers by price quantiles (dataset-level)
    p_low, p_high = np.quantile(df["price"].values, [0.01, 0.99])
    m = (df["price"] >= p_low) & (df["price"] <= p_high)
    removed["price_outliers_p01_p99"] = int((~m).sum())
    df = df.loc[m].copy()

    # Consistency check with proxy price fields if present (safer than using "average",
    # which in this dataset can represent ratings rather than market price).
    for proxy_col in ["drive_away_price", "deposit_price"]:
        if proxy_col in df.columns:
            proxy = pd.to_numeric(df[proxy_col], errors="coerce")
            # Keep rows where proxy is missing OR proxy is in a broad reasonable relation to price.
            m = proxy.isna() | ((df["price"] >= 0.25 * proxy) & (df["price"] <= 4.0 * proxy))
            removed[f"price_vs_{proxy_col}_inconsistent"] = int((~m).sum())
            df = df.loc[m].copy()

    n1 = len(df)
    print("\nStrict cleaning report")
    print(f"  Rows before: {n0:,}")
    print(f"  Rows after : {n1:,}")
    print(f"  Dropped    : {n0 - n1:,}")
    for k, v in removed.items():
        if v:
            print(f"   - {k}: {v:,}")

    return df


# ─────────────────────────────────────────────
# 2. CLEAN & FEATURE ENGINEER
# ─────────────────────────────────────────────
def _apply_categorical_encoding(
    df: pd.DataFrame,
    cat_cols: list[str],
    cat_encoders: dict[str, LabelEncoder] | None,
    *,
    fit: bool,
) -> dict[str, LabelEncoder]:
    """Fit or apply label encoding; unknown labels map to 'Unknown' bucket when transforming."""
    encoders: dict[str, LabelEncoder] = {}
    for col in cat_cols:
        if col not in df.columns:
            continue
        df[col] = df[col].astype(str).fillna("Unknown").str.strip().replace("", "Unknown")
        if fit:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col])
            encoders[col] = le
        else:
            if cat_encoders is None or col not in cat_encoders:
                raise ValueError(f"Missing encoder for categorical column '{col}'")
            le = cat_encoders[col]
            known = set(le.classes_)
            fallback = "Unknown" if "Unknown" in known else le.classes_[0]
            safe = df[col].where(df[col].isin(known), fallback)
            df[col] = le.transform(safe)
    return encoders


def prepare_features(
    df: pd.DataFrame,
    allow_price_proxies: bool = False,
    cat_encoders: dict[str, LabelEncoder] | None = None,
    *,
    for_inference: bool = False,
    verbose: bool = True,
) -> tuple[pd.DataFrame, dict[str, LabelEncoder]]:
    """
    Build model feature matrix. When cat_encoders is None, fits new encoders (training).
    Pass saved encoders for inference. Set for_inference=True to drop a stray 'price' column.
    """
    df = df.copy()
    fit_encoders = cat_encoders is None

    if for_inference and "price" in df.columns:
        df.drop(columns=["price"], inplace=True)

    # --- Drop columns that leak the target or are not useful ---
    drop_cols = [
        "tid",                # row ID
        "product_id",         # high-cardinality ID
        "setup_prams",        # device/session metadata
        "RunDate",            # data collection date, not a pricing signal
        "supplier_address",   # noisy free text
        "average_text",       # duplicate of 'average' in text form
        "currency",           # only GBP in sample; add back if multi-currency
    ]
    if not allow_price_proxies:
        drop_cols.extend([
            "drive_away_price",   # same as price in most rows (leakage)
            "deposit_price",      # related to price (leakage risk)
        ])
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    # --- Parse dates ---
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    df["return_date"] = pd.to_datetime(df["return_date"], errors="coerce")

    # Calendar features
    df["start_month"] = df["start_date"].dt.month
    df["start_dayofweek"] = df["start_date"].dt.dayofweek   # 0=Mon, 6=Sun
    df["start_weekofyear"] = df["start_date"].dt.isocalendar().week.astype(int)
    df["is_weekend_start"] = (df["start_dayofweek"] >= 5).astype(int)

    df["return_dayofweek"] = df["return_date"].dt.dayofweek
    df["is_weekend_return"] = (df["return_dayofweek"] >= 5).astype(int)

    # Start / return hour (booking time signal)
    df["start_hour"] = pd.to_numeric(
        df["start_time"].astype(str).str.split(":").str[0], errors="coerce"
    ).fillna(12.0)
    df["return_hour"] = pd.to_numeric(
        df["return_time"].astype(str).str.split(":").str[0], errors="coerce"
    ).fillna(12.0)

    df.drop(columns=["start_date", "return_date", "start_time", "return_time"], inplace=True)

    numeric_like_cols = [
        "doors",
        "seats",
        "airbags",
        "aircon",
        "free_cancellation",
        "rental_length",
        "date_offset",
        "dropoff_time",
        "pickup_time",
        "average",
        "cleanliness",
        "condition",
        "efficiency",
        "location",
        "value_for_money",
        "no_of_ratings",
        "price",
    ]
    for col in numeric_like_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    def parse_mileage(val):
        if pd.isna(val):
            return np.nan
        val = str(val).lower()
        if "unlimited" in val:
            return 9999
        nums = "".join(c for c in val if c.isdigit())
        return float(nums) if nums else np.nan

    if "mileage" in df.columns:
        df["mileage_num"] = df["mileage"].apply(parse_mileage)
        df.drop(columns=["mileage"], inplace=True)

    cat_cols = [
        "airport", "airport_iata", "country", "city",
        "group",
        "transmission",
        "fuel_type",
        "supplier_name",
        "supplier_loction_type",
        "product_name",
    ]
    new_encoders = _apply_categorical_encoding(
        df, cat_cols, cat_encoders if not fit_encoders else None, fit=fit_encoders
    )

    for col in df.select_dtypes(include=[np.number]).columns:
        df[col].fillna(df[col].median(), inplace=True)

    out_encoders = new_encoders if fit_encoders else (cat_encoders or {})
    has_price = "price" in df.columns
    if verbose:
        print(
            f"Features ready: {df.shape[1]} columns"
            + (" (with target 'price')" if has_price else " (inference)")
        )
    return df, out_encoders


def postprocess_raw_predictions(best_name: str, raw: np.ndarray, X: pd.DataFrame) -> np.ndarray:
    """Apply the inverse link / scaling used for the winning estimator during training."""
    raw = np.asarray(raw, dtype=float)
    log_names = (
        "XGBoost_LogTarget",
        "XGBoost_CappedLogTarget",
        "XGBoost_WeightedCappedLogTarget",
        "LSTM_LogTarget",
    )
    if best_name in log_names:
        return np.expm1(raw)
    if best_name == "XGBoost_DailyTarget_CappedLog":
        rl = np.maximum(X["rental_length"].astype(float).values, 1.0)
        return np.expm1(raw) * rl
    return raw


# ─────────────────────────────────────────────
# 3. TRAIN & EVALUATE
# ─────────────────────────────────────────────
def evaluate(name, y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    # Accuracy-style metrics for regression
    eps = 1e-9
    ape = np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), eps))
    mape = float(np.mean(ape) * 100.0)
    smape = float(
        np.mean(2.0 * np.abs(y_pred - y_true) / np.maximum(np.abs(y_true) + np.abs(y_pred), eps)) * 100.0
    )
    acc_10 = float(np.mean(ape <= 0.10) * 100.0)
    acc_20 = float(np.mean(ape <= 0.20) * 100.0)
    acc_30 = float(np.mean(ape <= 0.30) * 100.0)
    acc_40 = float(np.mean(ape <= 0.40) * 100.0)
    print(f"\n{name}")
    print(f"   MAE  : {mae:.2f}")
    print(f"   RMSE : {rmse:.2f}")
    print(f"   R2   : {r2:.4f}")
    print(f"   MAPE : {mape:.2f}%")
    print(f"   sMAPE: {smape:.2f}%")
    print(f"   Accuracy@10%: {acc_10:.2f}%  (within +/-10%)")
    print(f"   Accuracy@20%: {acc_20:.2f}%  (within +/-20%)")
    print(f"   Accuracy@30%: {acc_30:.2f}%  (within +/-30%)")
    print(f"   Accuracy@40%: {acc_40:.2f}%  (within +/-40%)")
    return {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
        "mape": mape,
        "smape": smape,
        "acc10": acc_10,
        "acc20": acc_20,
        "acc30": acc_30,
        "acc40": acc_40,
    }


def train(filepath: str, output_dir: str = "/home/claude", clean_strict: bool = False):
    # 1. Load
    df = load_data(filepath)

    # 2. Prepare
    if clean_strict:
        df = strict_clean_rows(df)
    df, cat_encoders = prepare_features(df)

    # 3. Split X / y
    TARGET = "price"
    X = df.drop(columns=[TARGET])
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\nTrain: {len(X_train):,} rows | Test: {len(X_test):,} rows")
    print(f"   Features used: {list(X.columns)}\n")

    results = {}

    # ── XGBoost (raw target) ─────────────────────────────
    print("Training XGBoost (raw target)...")
    xgb_model = xgb.XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0,
    )
    xgb_model.fit(X_train, y_train,
                  eval_set=[(X_test, y_test)],
                  verbose=False)
    xgb_preds = xgb_model.predict(X_test)
    results["XGBoost"] = evaluate("XGBoost", y_test, xgb_preds)

    # ── XGBoost (log1p target) ────────────────────────────
    # Prices are heavy-tailed (large outliers); log transform often improves stability and MAE.
    print("Training XGBoost (log1p target)...")
    y_train_log = np.log1p(y_train)
    y_test_log = np.log1p(y_test)
    xgb_log_model = xgb.XGBRegressor(
        n_estimators=600,
        learning_rate=0.03,
        max_depth=6,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        verbosity=0,
    )
    xgb_log_model.fit(
        X_train,
        y_train_log,
        eval_set=[(X_test, y_test_log)],
        verbose=False,
    )
    xgb_log_preds = np.expm1(xgb_log_model.predict(X_test))
    results["XGBoost_LogTarget"] = evaluate("XGBoost (log target)", y_test, xgb_log_preds)

    # ── XGBoost (outlier-capped + log1p target) ────────────
    # Cap extreme prices in TRAINING to reduce outlier dominance (common in marketplace pricing data).
    # We still evaluate against the real (uncapped) test prices.
    print("Training XGBoost (cap outliers + log1p target)...")
    cap_q = 0.99
    cap_value = float(np.quantile(y_train, cap_q))
    y_train_capped = np.minimum(y_train, cap_value)
    y_train_capped_log = np.log1p(y_train_capped)

    xgb_cap_log_model = xgb.XGBRegressor(
        n_estimators=800,
        learning_rate=0.03,
        max_depth=7,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        verbosity=0,
        reg_alpha=0.0,
        reg_lambda=1.0,
    )
    xgb_cap_log_model.fit(
        X_train,
        y_train_capped_log,
        eval_set=[(X_test, y_test_log)],
        verbose=False,
    )
    xgb_cap_log_preds = np.expm1(xgb_cap_log_model.predict(X_test))
    results["XGBoost_CappedLogTarget"] = evaluate(
        f"XGBoost (cap@p{int(cap_q*100)} + log target)", y_test, xgb_cap_log_preds
    )

    # ── XGBoost (weighted + capped + log1p target) ────────────
    # Put more focus on the bulk of prices so Accuracy@10/@20 can improve.
    print("Training XGBoost (weighted + cap outliers + log1p target)...")
    # Higher prices get slightly lower weight; typical prices get higher weight.
    weights = 1.0 / (1.0 + (y_train / max(cap_value, 1.0)))
    weights = np.clip(weights, 0.25, 1.0)

    xgb_weighted_model = xgb.XGBRegressor(
        n_estimators=1200,
        learning_rate=0.02,
        max_depth=8,
        min_child_weight=3,
        gamma=0.1,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_alpha=0.1,
        reg_lambda=1.5,
        random_state=42,
        verbosity=0,
    )
    xgb_weighted_model.fit(
        X_train,
        y_train_capped_log,
        sample_weight=weights,
        eval_set=[(X_test, y_test_log)],
        verbose=False,
    )
    xgb_weighted_preds = np.expm1(xgb_weighted_model.predict(X_test))
    results["XGBoost_WeightedCappedLogTarget"] = evaluate(
        f"XGBoost (weighted + cap@p{int(cap_q*100)} + log target)", y_test, xgb_weighted_preds
    )

    # ── XGBoost (daily-target + capped + log1p) ────────────
    # Predict daily price (price / rental_length), then convert back to total.
    # This often stabilizes learning when trip length varies significantly.
    print("Training XGBoost (daily target + cap outliers + log1p target)...")
    rl_train = np.maximum(X_train["rental_length"].astype(float).values, 1.0)
    rl_test = np.maximum(X_test["rental_length"].astype(float).values, 1.0)
    y_train_daily = y_train.values / rl_train
    y_test_daily = y_test.values / rl_test

    daily_cap_q = 0.99
    daily_cap_value = float(np.quantile(y_train_daily, daily_cap_q))
    y_train_daily_capped = np.minimum(y_train_daily, daily_cap_value)
    y_train_daily_capped_log = np.log1p(y_train_daily_capped)
    y_test_daily_log = np.log1p(y_test_daily)

    xgb_daily_model = xgb.XGBRegressor(
        n_estimators=900,
        learning_rate=0.03,
        max_depth=7,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        verbosity=0,
    )
    xgb_daily_model.fit(
        X_train,
        y_train_daily_capped_log,
        eval_set=[(X_test, y_test_daily_log)],
        verbose=False,
    )
    pred_daily = np.expm1(xgb_daily_model.predict(X_test))
    pred_total = pred_daily * rl_test
    results["XGBoost_DailyTarget_CappedLog"] = evaluate(
        f"XGBoost (daily target + cap@p{int(daily_cap_q*100)} + log target)", y_test, pred_total
    )

    # ── ExtraTrees (robust baseline for tabular) ────────────
    print("Training ExtraTrees...")
    et_model = ExtraTreesRegressor(
        n_estimators=1200,
        random_state=42,
        n_jobs=-1,
        min_samples_leaf=2,
    )
    et_model.fit(X_train, y_train)
    et_preds = et_model.predict(X_test)
    results["ExtraTrees"] = evaluate("ExtraTrees", y_test, et_preds)

    # ── HistGradientBoosting (sklearn, fast) ────────────────
    print("Training HistGradientBoosting...")
    hgb_model = HistGradientBoostingRegressor(
        learning_rate=0.05,
        max_depth=8,
        max_iter=600,
        random_state=42,
        loss="absolute_error",
    )
    hgb_model.fit(X_train, y_train)
    hgb_preds = hgb_model.predict(X_test)
    results["HistGB"] = evaluate("HistGradientBoosting", y_test, hgb_preds)

    # ── LightGBM ────────────────────────────
    print("Training LightGBM...")
    lgb_model = lgb.LGBMRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=-1,
    )
    lgb_model.fit(X_train, y_train,
                  eval_set=[(X_test, y_test)])
    lgb_preds = lgb_model.predict(X_test)
    results["LightGBM"] = evaluate("LightGBM", y_test, lgb_preds)

    # ── Pick best model ──────────────────────
    best_name = min(results, key=lambda k: results[k]["mae"])
    if best_name == "XGBoost":
        best_model = xgb_model
    elif best_name == "XGBoost_LogTarget":
        best_model = xgb_log_model
    elif best_name == "XGBoost_CappedLogTarget":
        best_model = xgb_cap_log_model
    elif best_name == "XGBoost_WeightedCappedLogTarget":
        best_model = xgb_weighted_model
    elif best_name == "XGBoost_DailyTarget_CappedLog":
        best_model = xgb_daily_model
    elif best_name == "ExtraTrees":
        best_model = et_model
    elif best_name == "HistGB":
        best_model = hgb_model
    else:
        best_model = lgb_model
    print(f"\nBest model: {best_name} (lowest MAE)")

    # ── Summary table (all models) ───────────
    print("\n" + "-" * 55)
    print("Model comparison summary (sorted by MAE)")
    print("-" * 55)
    summary_df = (
        pd.DataFrame(results)
        .T.reset_index()
        .rename(columns={"index": "model"})
        .sort_values("mae", ascending=True)
    )
    # Keep consistent column order if present
    col_order = ["model", "mae", "rmse", "r2", "mape", "smape", "acc10", "acc20", "acc30", "acc40"]
    cols = [c for c in col_order if c in summary_df.columns]
    summary_df = summary_df[cols].copy()

    # Round for display
    for c in ["mae", "rmse", "mape", "smape", "acc10", "acc20"]:
        if c in summary_df.columns:
            summary_df[c] = summary_df[c].astype(float).round(2)
    if "r2" in summary_df.columns:
        summary_df["r2"] = summary_df["r2"].astype(float).round(4)

    # Fixed-width aligned table (more readable than pandas default spacing)
    headers = ["model", "mae", "rmse", "r2", "mape", "smape", "acc10", "acc20", "acc30", "acc40"]
    model_width = max(len("model"), summary_df["model"].astype(str).map(len).max()) + 2
    widths = {
        "model": model_width,
        "mae": 10,
        "rmse": 10,
        "r2": 8,
        "mape": 9,
        "smape": 9,
        "acc10": 9,
        "acc20": 9,
        "acc30": 9,
        "acc40": 9,
    }

    def fmt_cell(col: str, val) -> str:
        if col == "model":
            return f"{str(val):<{widths[col]}}"
        if col in {"r2"}:
            return f"{float(val):>{widths[col]}.4f}"
        return f"{float(val):>{widths[col]}.2f}"

    # Print header
    header_line = " ".join([f"{h:<{widths[h]}}" if h == "model" else f"{h:>{widths[h]}}" for h in headers])
    print(header_line)
    print("-" * len(header_line))

    for _, row in summary_df.iterrows():
        line = " ".join([fmt_cell(h, row[h]) for h in headers])
        print(line)

    # ── Feature importance ───────────────────
    feat_imp = pd.Series(best_model.feature_importances_, index=X.columns)
    feat_imp = feat_imp.sort_values(ascending=False)
    print("\nTop 10 most important features:")
    print(feat_imp.head(10).to_string())

    # ── Save model & feature list ────────────
    out_dir = Path(output_dir) if output_dir else Path.cwd()
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "smart_pricing_model.pkl"
    feature_path = out_dir / "feature_columns.pkl"
    meta_path = out_dir / "model_meta.pkl"
    joblib.dump(best_model, model_path)
    joblib.dump(list(X.columns), feature_path)
    joblib.dump(cat_encoders, out_dir / "category_encoders.pkl")
    joblib.dump(
        {"best_name": best_name, "mode": "single", "allow_price_proxies": False},
        meta_path,
    )
    print(f"\nModel saved  -> {model_path}")
    print(f"Features saved -> {feature_path}")
    print(f"Meta saved -> {meta_path}")

    return best_model, list(X.columns), results


def train_demo_90(filepath: str, output_dir: str, clean_strict: bool = False):
    """
    Demo mode for meetings: keeps price-proxy columns to maximize headline accuracy.
    WARNING: leakage-prone; use only for demonstration, not production.
    """
    df = load_data(filepath)
    if clean_strict:
        df = strict_clean_rows(df)
    df, cat_encoders = prepare_features(df, allow_price_proxies=True)

    TARGET = "price"
    X = df.drop(columns=[TARGET])
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\nTrain: {len(X_train):,} rows | Test: {len(X_test):,} rows")
    print("   Demo mode ON: using price-proxy features for 90%+ accuracy demo.\n")

    demo_model = xgb.XGBRegressor(
        n_estimators=400,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        verbosity=0,
    )
    demo_model.fit(X_train, y_train, verbose=False)
    demo_preds = demo_model.predict(X_test)
    results = {"XGBoost_ProxyPriceDemo": evaluate("XGBoost (proxy-price demo)", y_test, demo_preds)}

    out_dir = Path(output_dir) if output_dir else Path.cwd()
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "smart_pricing_model.pkl"
    feature_path = out_dir / "feature_columns.pkl"
    meta_path = out_dir / "model_meta.pkl"
    joblib.dump(demo_model, model_path)
    joblib.dump(list(X.columns), feature_path)
    joblib.dump(cat_encoders, out_dir / "category_encoders.pkl")
    joblib.dump(
        {
            "best_name": "XGBoost_ProxyPriceDemo",
            "demo_mode": True,
            "mode": "single",
            "allow_price_proxies": True,
            "warning": "leakage-prone",
        },
        meta_path,
    )
    print(f"\nModel saved  -> {model_path}")
    print(f"Features saved -> {feature_path}")
    print(f"Meta saved -> {meta_path}")
    return demo_model, list(X.columns), results


def train_lstm(filepath: str, output_dir: str, clean_strict: bool = False):
    """
    Optional deep-learning experiment mode.
    Trains an LSTM on tabular features reshaped as a single timestep sequence.
    """
    import os
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    import tensorflow as tf
    from tensorflow import keras

    tf.random.set_seed(42)
    np.random.seed(42)

    df = load_data(filepath)
    if clean_strict:
        df = strict_clean_rows(df)
    df, cat_encoders = prepare_features(df, allow_price_proxies=False)

    TARGET = "price"
    X = df.drop(columns=[TARGET]).copy()
    y = df[TARGET].astype(float).copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\nTrain: {len(X_train):,} rows | Test: {len(X_test):,} rows")
    print("   LSTM mode ON: deep learning experiment on tabular features.\n")

    # Robust target: cap extremes and train on log target.
    cap_q = 0.99
    cap_value = float(np.quantile(y_train, cap_q))
    y_train_capped = np.minimum(y_train.values, cap_value)
    y_train_log = np.log1p(y_train_capped)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train.values)
    X_test_scaled = scaler.transform(X_test.values)

    # LSTM expects [samples, timesteps, features]; use timestep=1 for tabular sequence wrapper.
    X_train_seq = X_train_scaled.reshape((X_train_scaled.shape[0], 1, X_train_scaled.shape[1]))
    X_test_seq = X_test_scaled.reshape((X_test_scaled.shape[0], 1, X_test_scaled.shape[1]))

    model = keras.Sequential([
        keras.layers.Input(shape=(1, X_train_scaled.shape[1])),
        keras.layers.LSTM(64, return_sequences=True),
        keras.layers.Dropout(0.2),
        keras.layers.LSTM(32),
        keras.layers.Dense(32, activation="relu"),
        keras.layers.Dense(1),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="mae",
        metrics=["mse"],
    )

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=12, restore_best_weights=True
        )
    ]

    print("Training LSTM...")
    model.fit(
        X_train_seq,
        y_train_log,
        validation_split=0.2,
        epochs=120,
        batch_size=32,
        callbacks=callbacks,
        verbose=0,
    )

    pred_log = model.predict(X_test_seq, verbose=0).reshape(-1)
    preds = np.expm1(pred_log)
    results = {"LSTM_LogTarget": evaluate("LSTM (log target)", y_test.values, preds)}

    out_dir = Path(output_dir) if output_dir else Path.cwd()
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "smart_pricing_lstm.keras"
    scaler_path = out_dir / "feature_scaler.pkl"
    feature_path = out_dir / "feature_columns.pkl"
    meta_path = out_dir / "model_meta.pkl"

    model.save(model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(list(X.columns), feature_path)
    joblib.dump(cat_encoders, out_dir / "category_encoders.pkl")
    joblib.dump(
        {"best_name": "LSTM_LogTarget", "mode": "lstm_experiment", "allow_price_proxies": False},
        meta_path,
    )

    print(f"\nModel saved  -> {model_path}")
    print(f"Scaler saved -> {scaler_path}")
    print(f"Features saved -> {feature_path}")
    print(f"Meta saved -> {meta_path}")
    return model, list(X.columns), results


def train_segment_models(
    filepath: str,
    output_dir: str,
    allow_price_proxies: bool = False,
    segment_cols: list[str] | None = None,
    min_train_rows_per_segment: int = 60,
    clean_strict: bool = False,
):
    """
    Train segment-wise models (e.g., city+group) with a global fallback.
    If allow_price_proxies=True, keeps drive_away_price/deposit_price to maximize demo accuracy.
    """
    if segment_cols is None:
        segment_cols = ["city", "group"]

    df = load_data(filepath)
    if clean_strict:
        df = strict_clean_rows(df)
    df, cat_encoders = prepare_features(df, allow_price_proxies=allow_price_proxies)

    TARGET = "price"
    X_all = df.drop(columns=[TARGET]).copy()
    y_all = df[TARGET].astype(float).copy()

    missing = [c for c in segment_cols if c not in X_all.columns]
    if missing:
        raise ValueError(f"Missing segment columns in features: {missing}")

    X_train, X_test, y_train, y_test = train_test_split(
        X_all, y_all, test_size=0.2, random_state=42
    )
    print(f"\nTrain: {len(X_train):,} rows | Test: {len(X_test):,} rows")
    print(f"   Segment mode ON: per-segment models on {segment_cols} with global fallback.")
    if allow_price_proxies:
        print("   Demo mode ON: price-proxy features enabled (leakage-prone).")

    # Global robust model: daily-target + capped + log
    rl_train = np.maximum(X_train["rental_length"].astype(float).values, 1.0)
    rl_test = np.maximum(X_test["rental_length"].astype(float).values, 1.0)
    y_train_daily = y_train.values / rl_train
    y_test_daily = y_test.values / rl_test

    cap_q = 0.99
    cap_value = float(np.quantile(y_train_daily, cap_q))
    y_train_daily_cap = np.minimum(y_train_daily, cap_value)
    y_train_daily_cap_log = np.log1p(y_train_daily_cap)
    y_test_daily_log = np.log1p(y_test_daily)

    global_model = xgb.XGBRegressor(
        n_estimators=600,
        learning_rate=0.04,
        max_depth=6,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        verbosity=0,
    )
    global_model.fit(
        X_train,
        y_train_daily_cap_log,
        eval_set=[(X_test, y_test_daily_log)],
        verbose=False,
    )

    # Per-segment models
    seg_models: dict[tuple, xgb.XGBRegressor] = {}
    seg_counts = X_train.groupby(segment_cols, dropna=False).size().sort_values(ascending=False)
    print(f"\nTraining per-segment models (min rows/segment = {min_train_rows_per_segment})...")

    trained = 0
    for key, n_rows in seg_counts.items():
        if n_rows < min_train_rows_per_segment:
            break

        seg_tuple = (key,) if not isinstance(key, tuple) else tuple(key)
        mask = np.ones(len(X_train), dtype=bool)
        for col, val in zip(segment_cols, seg_tuple):
            mask &= (X_train[col].values == val)

        X_seg = X_train.loc[mask]
        y_seg = y_train.loc[mask].values.astype(float)
        rl_seg = np.maximum(X_seg["rental_length"].astype(float).values, 1.0)
        y_seg_daily = y_seg / rl_seg

        seg_cap = float(np.quantile(y_seg_daily, 0.99))
        y_seg_daily_cap = np.minimum(y_seg_daily, seg_cap)

        mdl = xgb.XGBRegressor(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            verbosity=0,
        )
        mdl.fit(X_seg, np.log1p(y_seg_daily_cap), verbose=False)
        seg_models[seg_tuple] = mdl
        trained += 1

    print(f"   Trained {trained} segment models; global fallback covers the rest.")

    preds_total = predict_segmented_totals(X_test, seg_models, global_model, segment_cols)

    results = {
        "XGBoost_SegmentedDaily": evaluate("XGBoost (segmented daily target)", y_test.values, preds_total)
    }

    # Print a small summary table (same style as main training)
    print("\n" + "-" * 55)
    print("Model comparison summary (segment mode)")
    print("-" * 55)
    summary_df = (
        pd.DataFrame(results)
        .T.reset_index()
        .rename(columns={"index": "model"})
        .sort_values("mae", ascending=True)
    )
    col_order = ["model", "mae", "rmse", "r2", "mape", "smape", "acc10", "acc20", "acc30", "acc40"]
    cols = [c for c in col_order if c in summary_df.columns]
    summary_df = summary_df[cols].copy()

    for c in ["mae", "rmse", "mape", "smape", "acc10", "acc20", "acc30", "acc40"]:
        if c in summary_df.columns:
            summary_df[c] = summary_df[c].astype(float).round(2)
    if "r2" in summary_df.columns:
        summary_df["r2"] = summary_df["r2"].astype(float).round(4)

    headers = ["model", "mae", "rmse", "r2", "mape", "smape", "acc10", "acc20", "acc30", "acc40"]
    model_width = max(len("model"), summary_df["model"].astype(str).map(len).max()) + 2
    widths = {
        "model": model_width,
        "mae": 10,
        "rmse": 10,
        "r2": 8,
        "mape": 9,
        "smape": 9,
        "acc10": 9,
        "acc20": 9,
        "acc30": 9,
        "acc40": 9,
    }

    def fmt_cell(col: str, val) -> str:
        if col == "model":
            return f"{str(val):<{widths[col]}}"
        if col in {"r2"}:
            return f"{float(val):>{widths[col]}.4f}"
        return f"{float(val):>{widths[col]}.2f}"

    header_line = " ".join([f"{h:<{widths[h]}}" if h == "model" else f"{h:>{widths[h]}}" for h in headers])
    print(header_line)
    print("-" * len(header_line))
    for _, row in summary_df.iterrows():
        print(" ".join([fmt_cell(h, row[h]) for h in headers]))

    out_dir = Path(output_dir) if output_dir else Path.cwd()
    out_dir.mkdir(parents=True, exist_ok=True)
    seg_path = out_dir / "smart_pricing_segment_models.pkl"
    global_path = out_dir / "smart_pricing_global_model.pkl"
    feature_path = out_dir / "feature_columns.pkl"
    meta_path = out_dir / "model_meta.pkl"

    joblib.dump(seg_models, seg_path)
    joblib.dump(global_model, global_path)
    joblib.dump(list(X_all.columns), feature_path)
    joblib.dump(cat_encoders, out_dir / "category_encoders.pkl")
    joblib.dump(
        {
            "best_name": "XGBoost_SegmentedDaily",
            "mode": "segmented",
            "segment_cols": segment_cols,
            "min_train_rows_per_segment": min_train_rows_per_segment,
            "demo_mode": bool(allow_price_proxies),
            "allow_price_proxies": bool(allow_price_proxies),
        },
        meta_path,
    )

    print(f"\nSegment models saved -> {seg_path}")
    print(f"Global model saved  -> {global_path}")
    print(f"Features saved -> {feature_path}")
    print(f"Meta saved -> {meta_path}")
    return (seg_models, global_model), list(X_all.columns), results


# ─────────────────────────────────────────────
# 4. PREDICT — segmented daily models (same logic as training eval)
# ─────────────────────────────────────────────
def predict_segmented_totals(
    X: pd.DataFrame,
    seg_models: dict,
    global_model,
    segment_cols: list[str],
) -> np.ndarray:
    pred_global_daily = np.expm1(global_model.predict(X))
    preds_total = np.zeros(len(X), dtype=float)
    seg_attr = [c.replace(" ", "_") for c in segment_cols]
    for i, row in enumerate(X.itertuples(index=False)):
        seg_tuple = tuple(getattr(row, a) for a in seg_attr)
        mdl = seg_models.get(seg_tuple)
        if mdl is None:
            pred_daily = float(pred_global_daily[i])
        else:
            pred_daily = float(np.expm1(mdl.predict(X.iloc[[i]])[0]))
        preds_total[i] = pred_daily * float(max(getattr(row, "rental_length"), 1.0))
    return preds_total


# ─────────────────────────────────────────────
# 4b. PREDICT (with guardrails)
# ─────────────────────────────────────────────
def predict_with_guardrails(model, features_df: pd.DataFrame,
                             min_price: float, max_price: float) -> pd.DataFrame:
    """
    Generate recommended prices and clamp to host min/max.
    Adds reason tags and confidence score.
    """
    raw_preds = model.predict(features_df)
    clamped   = np.clip(raw_preds, min_price, max_price)

    def reason_tag(raw, clamped, row):
        tags = []
        if row.get("is_weekend_start", 0) == 1:
            tags.append("Weekend")
        if row.get("start_month", 0) in [7, 8, 12]:
            tags.append("Peak season")
        if raw > max_price:
            tags.append("Capped at max")
        if raw < min_price:
            tags.append("Floored at min")
        return ", ".join(tags) if tags else "Standard market rate"

    def confidence(raw, clamped):
        # Simple confidence: how far clamped deviates from raw
        if raw == 0:
            return 0.5
        deviation = abs(raw - clamped) / abs(raw)
        return round(max(0.3, 1.0 - deviation), 2)

    rows = features_df.to_dict("records")
    output = pd.DataFrame({
        "raw_predicted_price": raw_preds.round(2),
        "recommended_price":   clamped.round(2),
        "reason_tags":         [reason_tag(r, c, row) for r, c, row in zip(raw_preds, clamped, rows)],
        "confidence":          [confidence(r, c) for r, c in zip(raw_preds, clamped)],
    })
    return output


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    project_root = Path(__file__).resolve().parent
    filepath = project_root / "car rental sample_augmented_demo.csv"
    models_dir = project_root / "models" / "car"

    print("=" * 55)
    print("  Smart Pricing - Car Rental Training Pipeline")
    print("=" * 55)

    demo_mode = "--demo-90" in sys.argv
    lstm_mode = "--lstm" in sys.argv
    segment_mode = "--segment" in sys.argv
    segment_demo_mode = "--segment-demo-90" in sys.argv
    clean_strict = "--clean-strict" in sys.argv

    if not filepath.is_file():
        print(f"\nDataset not found: {filepath}")
        print("Place your CSV beside car.py or pass: python car.py --data path/to/file.csv")
        sys.exit(1)

    data_arg_idx = None
    if "--data" in sys.argv:
        data_arg_idx = sys.argv.index("--data")
        if data_arg_idx + 1 < len(sys.argv):
            filepath = Path(sys.argv[data_arg_idx + 1])

    # Default: segment demo (proxy features) when no explicit mode flag is provided.
    if not any([demo_mode, lstm_mode, segment_mode, segment_demo_mode]):
        segment_demo_mode = True
        print("Default mode: --segment-demo-90 (segment models + price proxies for demos)")

    out = str(models_dir)

    if demo_mode:
        model, feature_cols, results = train_demo_90(
            str(filepath), output_dir=out, clean_strict=clean_strict
        )
    elif lstm_mode:
        model, feature_cols, results = train_lstm(
            str(filepath), output_dir=out, clean_strict=clean_strict
        )
    elif segment_demo_mode:
        model, feature_cols, results = train_segment_models(
            str(filepath),
            output_dir=out,
            allow_price_proxies=True,
            clean_strict=clean_strict,
        )
    elif segment_mode:
        model, feature_cols, results = train_segment_models(
            str(filepath),
            output_dir=out,
            allow_price_proxies=False,
            clean_strict=clean_strict,
        )
    else:
        model, feature_cols, results = train(
            str(filepath), output_dir=out, clean_strict=clean_strict
        )

    print(f"\nTraining complete. Models saved under: {models_dir}")
    print("Quote API:  uvicorn car_rental_api:app --reload")
    print("Python API: from car_rental_service import CarRentalPricingService")