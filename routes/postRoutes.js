import express from "express";
import multer from "multer";
import Blog_table from "../models/postModel.js";

const router = express.Router();

/* ===================== MULTER STORAGE ===================== */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/posts");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/* ============================================================
   CREATE NEW POST
============================================================ */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, shortDescription, longDescription, date } = req.body;

    if (!req.file)
      return res.status(400).json({ message: "Image is required" });

    const imagePath = `uploads/posts/${req.file.filename}`;

    const newPost = await Blog_table.create({
      title,
      shortDescription,
      longDescription,
      date,
      image: imagePath,
    });

    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ message: "Failed to add post" });
  }
});

/* ============================================================
   GET ALL POSTS
============================================================ */
router.get("/", async (req, res) => {
  try {
    const posts = await Blog_table.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

/* ============================================================
   GET SINGLE POST BY ID
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const post = await Blog_table.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch post" });
  }
});

/* ============================================================
   UPDATE / EDIT POST
   (optional image upload)
============================================================ */
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, shortDescription, longDescription, date } = req.body;

    let updateData = {
      title,
      shortDescription,
      longDescription,
      date,
    };

    // if new image is uploaded
    if (req.file) {
      updateData.image = `uploads/posts/${req.file.filename}`;
    }

    const updatedPost = await Blog_table.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updatedPost)
      return res.status(404).json({ message: "Post not found" });

    res.json(updatedPost);
  } catch (err) {
    res.status(500).json({ message: "Failed to update post" });
  }
});

/* ============================================================
   DELETE POST
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const post = await Blog_table.findByIdAndDelete(req.params.id);

    if (!post)
      return res.status(404).json({ message: "Post not found" });

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete post" });
  }
});

export default router;
