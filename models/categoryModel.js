import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    category_name: { type: String, required: true, unique: true, trim: true },
    category_image: { type: String, required: true },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);


const Category_table = mongoose.model("Category_table", categorySchema);
export default Category_table;