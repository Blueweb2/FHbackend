import express from "express";
import multer from "multer";
import fs from "fs";
import Category_table from "../models/categoryModel.js";

const router = express.Router();

/* ==========================================================
   🧱 Multer Storage Setup
========================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "/var/www/uploads/categories";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

/* ==========================================================
   ✅ 1. Add New Category  (priority auto = 0)
========================================================== */
router.post("/add", (req, res) => {
  const singleUpload = upload.single("image");

  singleUpload(req, res, async (err) => {
    if (err) {
      console.error("Multer error while adding category:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "File upload error",
      });
    }

    try {
      const { category_name } = req.body;
      const image = req.file ? `uploads/categories/${req.file.filename}` : null;

      if (!category_name || !image) {
        return res.status(400).json({
          success: false,
          message: "All fields required",
        });
      }

      const newCategory = new Category_table({
        category_name,
        category_image: image,
        priority: 0, // ⭐ default value
      });

      await newCategory.save();

      res.json({
        success: true,
        message: "✅ Category added successfully",
        category: newCategory,
      });
    } catch (error) {
      console.error("❌ Error adding category:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

/* ==========================================================
   ✅ 2. Admin View (SORTED BY PRIORITY)
========================================================== */
router.post("/view", async (req, res) => {
  try {
    const categories = await Category_table.find({}).sort({ priority: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==========================================================
   ⭐ 2B. Update Priority (Drag & Drop)
========================================================== */
router.post("/update-priority", async (req, res) => {
  try {
    const { categories } = req.body;

    for (let c of categories) {
      await Category_table.findByIdAndUpdate(c.id, { priority: c.priority });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating priorities",
      error: error.message,
    });
  }
});

/* ==========================================================
   ✅ 3. User View (SORTED BY PRIORITY)
========================================================== */
router.get("/userview", async (req, res) => {
  try {
    const categories = await Category_table.find({}).sort({ priority: 1 });
    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error fetching categories for user view:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==========================================================
   ✅ 4. Search Category (also sorted by priority)
========================================================== */
router.post("/search", async (req, res) => {
  try {
    const { category_name } = req.body;

    const categories = await Category_table
      .find({
        category_name: { $regex: category_name, $options: "i" },
      })
      .sort({ priority: 1 });

    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error searching category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==========================================================
   ✅ 5. Update Category (Name + Optional Image)
========================================================== */
router.put("/update/:id", (req, res) => {
  const singleUpload = upload.single("image");

  singleUpload(req, res, async (err) => {
    if (err) {
      console.error("❌ Multer error during update:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "File upload error",
      });
    }

    try {
      const { id } = req.params;
      const { category_name } = req.body;

      if (!category_name) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      const category = await Category_table.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      let newImagePath = category.category_image;

      if (req.file) {
        newImagePath = `uploads/categories/${req.file.filename}`;

        const oldPath = `/var/www/${category.category_image}`;
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      category.category_name = category_name;
      category.category_image = newImagePath;

      await category.save();

      res.json({
        success: true,
        message: "Category updated successfully",
        category,
      });
    } catch (error) {
      console.error("❌ Error updating category:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  });
});

/* ==========================================================
   ✅ 6. Delete Category
========================================================== */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Category ID required" });
    }

    const category = await Category_table.findById(id);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    if (category.category_image) {
      const imagePath = `/var/www/${category.category_image}`;
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await Category_table.findByIdAndDelete(id);

    res.json({ success: true, message: "✅ Category deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
