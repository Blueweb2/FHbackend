import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    // Shared text
    title: { type: String, required: false },
    subtitle: { type: String, required: false },

    // Images
    image: { type: String, required: true },        // desktop image
    mobileImage: { type: String, required: true },  // mobile image

    // Text mode: "light" or "dark"
    textMode: { type: String, enum: ["light", "dark"], default: "dark" },

    // System fields
    active: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const BannerTable = mongoose.model("Banner_table", bannerSchema);
export default BannerTable;
