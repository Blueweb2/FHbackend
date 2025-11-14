import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import BannerTable from "../models/Banner.js";

const router = express.Router();

// =================================================
//                  MULTER STORAGE
// =================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
  //  const uploadPath = "uploads/banners";
    const uploadPath = "/var/www/uploads/banners";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// =================================================
//            CREATE BANNER (desktop + mobile)
// =================================================

router.post(
  "/",
  upload.fields([
    { name: "desktopImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Desktop image must be uploaded
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

        // required desktop image
        image: desktopImage,

        // required mobile image
        mobileImage,

        // "light" or "dark"
        textMode: req.body.textMode === "light" ? "light" : "dark",
      });

      await banner.save();
      res.status(201).json({ success: true, banner });
    } catch (error) {
      console.error("ERROR while uploading banner:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

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
//                  GET ACTIVE
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
      return res
        .status(400)
        .json({ message: "Only 2 banners can be active at a time" });
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
//                    DELETE
// =================================================
router.delete("/:id", async (req, res) => {
  try {
    const banner = await BannerTable.findById(req.params.id);
    if (!banner)
      return res.status(404).json({ message: "Banner not found" });

    // Delete desktop image
    if (banner.image && fs.existsSync(banner.image)) {
      fs.unlinkSync(banner.image);
    }

    // Delete mobile image
    if (banner.mobileImage && fs.existsSync(banner.mobileImage)) {
      fs.unlinkSync(banner.mobileImage);
    }

    await banner.deleteOne();

    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
