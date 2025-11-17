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
   ✅ 1. Add New Category
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
   ✅ 2. View All Categories (Newest First)
========================================================== */
router.post("/view", async (req, res) => {
  try {
    const categories = await Category_table.find({}).sort({ createdAt: -1 });
    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==========================================================
   ✅ 3. User View (Public)
========================================================== */
router.get("/userview", async (req, res) => {
  try {
    const categories = await Category_table.find({});
    res.json({ success: true, categories });
  } catch (error) {
    console.error("❌ Error fetching categories for user view:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==========================================================
   ✅ 4. Search Category by Name
========================================================== */
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

/* ==========================================================
   ✅ 5. Update Category (Name + Optional Image)
========================================================== */
// router.put("/update/:id", (req, res) => {
//   const singleUpload = upload.single("image");

//   singleUpload(req, res, async (err) => {
//     if (err) {
//       console.error("❌ Multer error during update:", err);
//       return res.status(400).json({
//         success: false,
//         message: err.message || "File upload error",
//       });
//     }

//     try {
//       const { id } = req.params;
//       const { category_name } = req.body;

//       if (!category_name) {
//         return res.status(400).json({
//           success: false,
//           message: "Category name is required",
//         });
//       }

//       const category = await Category_table.findById(id);
//       if (!category) {
//         return res.status(404).json({
//           success: false,
//           message: "Category not found",
//         });
//       }

//       let newImagePath = category.category_image; // keep old image

//       // If new image uploaded
//       if (req.file) {
//         newImagePath = `uploads/categories/${req.file.filename}`;

//         // Delete old image file if exists
//         const oldPath = `/var/www/${category.category_image}`;
//         if (category.category_image && fs.existsSync(oldPath)) {
//           fs.unlinkSync(oldPath);
//         }
//       }

//       category.category_name = category_name;
//       category.category_image = newImagePath;

//       await category.save();

//       res.json({
//         success: true,
//         message: "✅ Category updated successfully",
//         category,
//       });
//     } catch (error) {
//       console.error("❌ Error updating category:", error);
//       res.status(500).json({
//         success: false,
//         message: "Server error while updating category",
//       });
//     }
//   });
// });


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

        // delete old image
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

    // Delete image file from server
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
