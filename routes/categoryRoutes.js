import express from "express";
import multer from "multer";
import fs from "fs";
import Category_table from "../models/categoryModel.js";

const router = express.Router();

// ✅ Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    
    // const dir = "uploads/categories";
     const dir = "/var/www/uploads/categories";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// ✅ Add category
router.post("/add", upload.single("image"), async (req, res) => {
  try {
    const { category_name } = req.body;
    const image = req.file ? `uploads/categories/${req.file.filename}` : null;

    if (!category_name || !image)
      return res.status(400).json({ success: false, message: "All fields required" });

    const newCategory = new Category_table({ category_name, category_image: image });
    await newCategory.save();

    res.json({ success: true, message: "✅ Category added successfully" });
  } catch (error) {
    console.error("❌ Error adding category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ View all categories (newest first)
router.post("/view", async (req, res) => {
  try {
    const categories = await Category_table.find({})
      .sort({ createdAt: -1 }); // ✅ newest first

    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// ✅ User view route
// ✅ Route for user category view search------------------
router.get("/userview", async (req, res) => {
  try {
    // Fetch all categories, optionally filter only active ones
    const categories = await Category_table.find({}); // or { status: "active" }
    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




// ✅ Search category
router.post("/search", async (req, res) => {
  try {
    const { category_name } = req.body;
    const categories = await Category_table.find({
      category_name: { $regex: category_name, $options: "i" },
    });
    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error searching category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Delete category
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "Category ID required" });

    await Category_table.findByIdAndDelete(id);
    res.json({ success: true, message: "✅ Category deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
