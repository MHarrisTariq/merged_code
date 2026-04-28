import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true },
    user_id: { type: String, default: null, index: true },
    data: { type: Object, default: {} },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("AnalyticsEvent", analyticsSchema);

