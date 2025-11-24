import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  // Unique product ID (you can generate manually or auto)
  prod_id: { type: String, required: true, unique: true, trim: true },

  // Product name
  product_name: { type: String, required: true, trim: true },

  // Category reference (linked to category_table)
  CAT_ID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category_table",
    required: true,
  },

  // Description of the product
  description: { type: String,  trim: true },

  // Optional extra info (technical specs, features, etc.)
product_info: {
  type: [
    {
      key: { type: String, trim: true },
      value: { type: String, trim: true }
    }
  ],
  default: []
},


  // Date when the product was added
  date: { type: Date, default: Date.now },
});

const Product_table = mongoose.model("product_table", productSchema);
export default Product_table;
