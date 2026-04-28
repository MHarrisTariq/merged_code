import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    avg_price: { type: Number, default: null },
    duration: { type: String, default: null },
    trend: { type: String, default: null },
    last_updated: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Route", routeSchema);

