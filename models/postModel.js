import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    shortDescription: {
      type: String,
      required: true,
      trim: true,
    },

    longDescription: {
      type: String,
      required: true,
    },

    image: {
      type: String,   // Blog main image URL
      required: true,
    },

    date: {
      type: String,   // Example: "DEC 24 2024"
      required: true,
    },
  },
  { timestamps: true }
);

const Blog_table= mongoose.model("Blog_table", blogSchema);
export default Blog_table;
