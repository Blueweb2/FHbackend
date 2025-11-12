import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import BannerTable from "../models/Banner.js"; // ✅ your model name

const router = express.Router();

// ✅ Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/banners";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({ storage });

// 🧱 POST: Upload a new banner
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const banner = new BannerTable({
      title: req.body.title,
      subtitle: req.body.subtitle,
      image: `uploads/banners/${req.file.filename}`,
    });

    await banner.save();
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 📋 GET: All banners
router.get("/", async (req, res) => {
  try {
    const banners = await BannerTable.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 🟢 GET: Active banners (for frontend carousel)
router.get("/active", async (req, res) => {
  try {
    const banners = await BannerTable.find({ active: true }).sort({ order: 1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ PUT: Activate a banner (max 2 active)
router.put("/:id/activate", async (req, res) => {
  try {
    const activeCount = await BannerTable.countDocuments({ active: true });

    if (activeCount >= 2) {
      return res.status(400).json({ message: "Only 2 banners can be active" });
    }

    const banner = await BannerTable.findByIdAndUpdate(
      req.params.id,
      { active: true },
      { new: true }
    );

    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 🔴 PUT: Deactivate banner
router.put("/:id/deactivate", async (req, res) => {
  try {
    const banner = await BannerTable.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ❌ DELETE: Remove banner
router.delete("/:id", async (req, res) => {
  try {
    const banner = await BannerTable.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // ✅ delete file if exists
    if (fs.existsSync(banner.image)) {
      fs.unlinkSync(banner.image);
    }

    await banner.deleteOne();
    res.json({ message: "Banner deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
