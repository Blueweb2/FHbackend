import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import BannerTable from "../models/Banner.js";

const router = express.Router();

// Maximum active banners allowed on frontend
const MAX_ACTIVE = 6;

// =================================================
//                  MULTER STORAGE
// =================================================
const UPLOAD_ROOT = "/var/www/uploads/banners";  

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

      // Determine order (append to end)
      const last = await BannerTable.findOne().sort({ order: -1 }).lean();
      const nextOrder = last ? last.order + 1 : 0;

      const banner = new BannerTable({
        title: req.body.title || "",
        subtitle: req.body.subtitle || "",
        image: desktopImage,
        mobileImage,
        textMode: req.body.textMode === "light" ? "light" : "dark",
        active: false, // default inactive
        order: nextOrder,
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
//                     GET ALL BANNERS
// =================================================
router.get("/", async (req, res) => {
  try {
    const banners = await BannerTable.find().sort({ order: 1 });
    res.json(banners);
  } catch (error) {
    console.error("GET /banners ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//               GET ACTIVE BANNERS (LIMITED)
// =================================================
router.get("/active", async (req, res) => {
  try {
    const banners = await BannerTable.find({ active: true })
      .sort({ order: 1 })
      .limit(MAX_ACTIVE)
      .select("_id title subtitle image mobileImage textMode order active");

    res.json(banners);
  } catch (error) {
    console.error("GET /active ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//          ACTIVATE (MAX 6 active allowed)
// =================================================
router.put("/:id/activate", async (req, res) => {
  try {
    const activeCount = await BannerTable.countDocuments({ active: true });

    if (activeCount >= MAX_ACTIVE) {
      return res.status(400).json({
        message: `Only ${MAX_ACTIVE} banners can be active at a time`,
      });
    }

    const banner = await BannerTable.findByIdAndUpdate(
      req.params.id,
      { active: true },
      { new: true }
    );

    if (!banner) return res.status(404).json({ message: "Banner not found" });

    res.json(banner);
  } catch (error) {
    console.error("ACTIVATE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
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

    if (!banner) return res.status(404).json({ message: "Banner not found" });

    res.json(banner);
  } catch (error) {
    console.error("DEACTIVATE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//               REORDER BANNERS
// =================================================
router.put("/reorder", async (req, res) => {
  const { order } = req.body; // array of IDs

  if (!Array.isArray(order)) {
    return res.status(400).json({ message: "Order must be an array" });
  }

  try {
    const bulkOps = order.map((id, idx) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: idx } },
      },
    }));

    await BannerTable.bulkWrite(bulkOps);

    res.json({ success: true, message: "Order updated" });
  } catch (error) {
    console.error("REORDER ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// =================================================
//           UPDATE BANNER (TEXT + IMAGES)
//             (DO NOT DELETE OLD FILES)
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

      // Replace Desktop (do NOT delete old file)
      if (req.files && req.files.desktopImage) {
        banner.image = `uploads/banners/${req.files.desktopImage[0].filename}`;
      }

      // Replace Mobile (do NOT delete old file)
      if (req.files && req.files.mobileImage) {
        banner.mobileImage = `uploads/banners/${req.files.mobileImage[0].filename}`;
      }

      // Update text fields
      banner.title = req.body.title ?? banner.title;
      banner.subtitle = req.body.subtitle ?? banner.subtitle;
      banner.textMode = req.body.textMode ?? banner.textMode;

      await banner.save();
      res.json({ success: true, banner });
    } catch (error) {
      console.error("UPDATE ERROR:", error);
      res.status(500).json({ message: error.message });
    }
  });
});

// =================================================
//               DELETE BANNER ONLY FROM DB
//        (KEEP ALL IMAGES SAFELY IN FILE SYSTEM)
// =================================================
router.delete("/:id", async (req, res) => {
  try {
    const banner = await BannerTable.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // ❗ DO NOT DELETE FILES
    // All images remain under /var/www/uploads/banners

    await banner.deleteOne();

    res.json({
      message: "Banner deleted from database only. Images retained.",
    });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
