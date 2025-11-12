import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: false },
    subtitle: { type: String, required: false },
    image: { type: String, required: true }, // path to the uploaded image
    active: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const BannerTable = mongoose.model("Banner_table", bannerSchema);
export default BannerTable;