export function internalAuthMiddleware({ exemptPaths = ["/health"] } = {}) {
  const token = process.env.INTERNAL_SERVICE_TOKEN || "";

  return function internalAuth(req, res, next) {
    if (exemptPaths.includes(req.path)) return next();
    // If token isn't configured, we keep services usable in local dev,
    // but in production you should set INTERNAL_SERVICE_TOKEN.
    if (!token) return next();
    const provided = String(req.headers["x-internal-token"] || "");
    if (provided !== token) return res.status(401).json({ error: "Unauthorized" });
    return next();
  };
}

