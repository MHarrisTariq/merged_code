import mongoose from "mongoose";

const priceSnapshotSchema = new mongoose.Schema(
  {
    route: { type: String, required: true, index: true },
    date_checked: { type: Date, required: true, index: true },
    departure_date: { type: Date, default: null },
    price: { type: Number, required: true },
    airline: { type: String, default: null },
    currency: { type: String, default: "USD" },
    source: { type: String, default: "stub" },
    days_before_departure: { type: Number, default: null },
  },
  { timestamps: true },
);

priceSnapshotSchema.index({ route: 1, date_checked: -1 });

export default mongoose.model("PriceSnapshot", priceSnapshotSchema);

