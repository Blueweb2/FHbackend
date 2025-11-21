import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import BannerTable from "../models/Banner.js";

const router = express.Router();

// =================================================
//                  MULTER STORAGE
// =================================================
const UPLOAD_ROOT = "/var/www/uploads/banners";   // base folder

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!fs.existsSync(UPLOAD_ROOT)) {
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    }
    cb(null, UPLOAD_ROOT);
  },
  filename(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Helper for absolute file path
const makeAbsolute = (relativePath) => {
  return path.join("/var/www", relativePath); // ensures correct delete path
};

// =================================================
//            CREATE BANNER (desktop + mobile)
// =================================================

router.post("/", (req, res) => {
  const fieldsUpload = upload.fields([
    { name: "desktopImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ]);

  fieldsUpload(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: err.message });
    }

    try {
      if (!req.files || !req.files.desktopImage) {
        return res.status(400).json({ message: "Desktop image is required" });
      }

      const desktopImage = `uploads/banners/${req.files.desktopImage[0].filename}`;
      const mobileImage = req.files.mobileImage
        ? `uploads/banners/${req.files.mobileImage[0].filename}`
        : null;

      const banner = new BannerTable({
        title: req.body.title || "",
        subtitle: req.body.subtitle || "",
        image: desktopImage,
        mobileImage,
        textMode: req.body.textMode === "light" ? "light" : "dark",
      });

      await banner.save();
      res.status(201).json({ success: true, banner });
    } catch (error) {
      console.error("Upload ERROR:", error);
      res.status(500).json({ message: error.message });
    }
  });
});

// =================================================
//                     GET ALL
// =================================================
router.get("/", async (req, res) => {
  try {
    const banners = await BannerTable.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (error) {
    console.error("GET /banners ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//                  GET ACTIVE (SORTED)
// =================================================
router.get("/active", async (req, res) => {
  try {
    const banners = await BannerTable.find({ active: true }).sort({ order: 1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//          ACTIVATE (MAX 2 BANNERS ACTIVE)
// =================================================
router.put("/:id/activate", async (req, res) => {
  try {
    const activeCount = await BannerTable.countDocuments({ active: true });

    if (activeCount >= 2) {
      return res.status(400).json({
        message: "Only 2 banners can be active at a time",
      });
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

// =================================================
//               REORDER BANNERS (SORTING)
// =================================================
router.put("/reorder", async (req, res) => {
  const { order } = req.body;

  if (!Array.isArray(order)) {
    return res.status(400).json({ message: "Order must be an array" });
  }

  try {
    for (let i = 0; i < order.length; i++) {
      await BannerTable.findByIdAndUpdate(order[i], { order: i });
    }

    res.json({ success: true, message: "Order updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//           UPDATE BANNER (TEXT + IMAGES)
// =================================================
router.put("/:id", (req, res) => {
  const updateUpload = upload.fields([
    { name: "desktopImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ]);

  updateUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const banner = await BannerTable.findById(req.params.id);
      if (!banner) return res.status(404).json({ message: "Banner not found" });

      // Replace Desktop
      if (req.files.desktopImage) {
        const absPath = makeAbsolute(banner.image);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

        banner.image = `uploads/banners/${req.files.desktopImage[0].filename}`;
      }

      // Replace Mobile
      if (req.files.mobileImage) {
        const absPath = makeAbsolute(banner.mobileImage);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

        banner.mobileImage = `uploads/banners/${req.files.mobileImage[0].filename}`;
      }

      // Update text fields
      banner.title = req.body.title ?? banner.title;
      banner.subtitle = req.body.subtitle ?? banner.subtitle;
      banner.textMode = req.body.textMode ?? banner.textMode;

      await banner.save();

      res.json({ success: true, banner });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error.message });
    }
  });
});

// =================================================
//                   DEACTIVATE
// =================================================
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

// =================================================
//                    DELETE BANNER
// =================================================
router.delete("/:id", async (req, res) => {
  try {
    const banner = await BannerTable.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // Remove desktop
    if (banner.image) {
      const absPath = makeAbsolute(banner.image);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    }

    // Remove mobile
    if (banner.mobileImage) {
      const absPath = makeAbsolute(banner.mobileImage);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    }

    await banner.deleteOne();

    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
