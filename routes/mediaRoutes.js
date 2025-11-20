// routes/mediaRoutes.js
import express from "express";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import multer from "multer";

// Models - ensure these paths match your project files
import Product from "../models/productModel.js";
import ProductSub from "../models/productImage.js";
import Category from "../models/categoryModel.js";
import Blog from "../models/blogModel.js";
import Banner from "../models/bannerModel.js";

const router = express.Router();
const UPLOAD_DIR = "/var/www/uploads";

// category → folder mapping
const categoryFolders = {
  products: "products",
  posts: "posts",
  banners: "banners",
  categories: "categories",
  all: "",
};

/* -----------------------------------------
   Metadata helpers (stored per category)
------------------------------------------*/
function metaFilePath(folder) {
  return path.join(UPLOAD_DIR, folder || "", "media.meta.json");
}

async function readMeta(folder) {
  const file = metaFilePath(folder);
  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch {
    return {}; // no meta yet
  }
}

async function writeMeta(folder, meta) {
  const file = metaFilePath(folder);
  const dir = path.dirname(file);
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(meta, null, 2), "utf8");
}

/* -----------------------------------------
   Prevent path traversal
------------------------------------------*/
function safeResolve(folder, fileName) {
  const resolved = path.normalize(path.join(UPLOAD_DIR, folder || "", fileName));
  if (!resolved.startsWith(UPLOAD_DIR)) throw new Error("Invalid path");
  return resolved;
}

/* -----------------------------------------
    Helper: list files inside a single folder
------------------------------------------*/
async function listFilesInFolder(folder) {
  const dir = folder ? path.join(UPLOAD_DIR, folder) : UPLOAD_DIR;
  try {
    const names = await fs.readdir(dir);
    return names.filter((n) => !n.startsWith(".") && n !== "media.meta.json");
  } catch (err) {
    return [];
  }
}

/* -----------------------------------------
    GET /api/media  (pagination + search + filter)
------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 40;
    const search = (req.query.search || "").toLowerCase();
    const category = req.query.category || "all";

    // Build list of folders to read
    let foldersToRead = [];
    if (category === "all" || !category) {
      foldersToRead = Object.keys(categoryFolders).filter((k) => k !== "all");
    } else {
      if (!categoryFolders[category]) {
        return res.status(400).json({ message: "Invalid category" });
      }
      foldersToRead = [category];
    }

    // gather file entries from each folder
    let entries = []; // { name, folder, catKey }
    for (const catKey of foldersToRead) {
      const folderName = categoryFolders[catKey];
      const files = await listFilesInFolder(folderName);
      for (const f of files) {
        entries.push({
          name: f,
          folder: folderName || "",
          catKey,
        });
      }
    }

    // read metas per-folder
    const metaMap = {};
    for (const catKey of foldersToRead) {
      const folderName = categoryFolders[catKey];
      metaMap[folderName || ""] = await readMeta(folderName);
    }

    // Search filter
    if (search) {
      entries = entries.filter((entry) => {
        const m = metaMap[entry.folder] && metaMap[entry.folder][entry.name] ? metaMap[entry.folder][entry.name] : {};
        return (
          entry.name.toLowerCase().includes(search) ||
          (m.title || "").toLowerCase().includes(search) ||
          (m.caption || "").toLowerCase().includes(search) ||
          (m.description || "").toLowerCase().includes(search)
        );
      });
    }

    // Sort favorites first
    entries.sort((a, b) => {
      const ma = (metaMap[a.folder] && metaMap[a.folder][a.name] && metaMap[a.folder][a.name].favorite) ? 1 : 0;
      const mb = (metaMap[b.folder] && metaMap[b.folder][b.name] && metaMap[b.folder][b.name].favorite) ? 1 : 0;
      return mb - ma;
    });

    const total = entries.length;
    const start = (page - 1) * limit;
    const pageEntries = entries.slice(start, start + limit);

    const items = pageEntries.map((entry) => {
      const meta = metaMap[entry.folder] && metaMap[entry.folder][entry.name] ? metaMap[entry.folder][entry.name] : {
        title: entry.name,
        alt: "",
        caption: "",
        description: "",
      };

      return {
        name: entry.name,
        folder: entry.folder,
        url: `/uploads/${entry.folder ? entry.folder + "/" : ""}${entry.name}`,
        downloadUrl: `/api/media/download/${encodeURIComponent(entry.name)}?cat=${encodeURIComponent(entry.folder || "")}`,
        meta,
      };
    });

    return res.json({ total, items, page, limit });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error loading media" });
  }
});

/* -----------------------------------------
    Multer upload route
------------------------------------------*/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = req.query.cat || "products";
    const savePath = path.join(UPLOAD_DIR, folder);

    if (!fsSync.existsSync(savePath)) {
      fsSync.mkdirSync(savePath, { recursive: true });
    }

    cb(null, savePath);
  },
  filename: function (req, file, cb) {
    const sanitized = file.originalname.replace(/\s+/g, "-");
    const unique = Date.now() + "-" + sanitized;
    cb(null, unique);
  },
});

const upload = multer({ storage });

router.post("/upload", upload.array("media"), async (req, res) => {
  try {
    const folder = req.query.cat || "products";
    const meta = await readMeta(folder);

    req.files.forEach((file) => {
      meta[file.filename] = {
        title: file.filename,
        alt: "",
        caption: "",
        description: "",
      };
    });

    await writeMeta(folder, meta);

    return res.json({
      ok: true,
      uploaded: req.files.map((f) => f.filename),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Upload failed" });
  }
});

/* -----------------------------------------
    FAVORITE toggle
------------------------------------------*/
router.post("/favorite/:name", express.json(), async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat || "";

    const meta = await readMeta(folder);
    if (!meta[file]) meta[file] = {};
    meta[file].favorite = req.body.favorite === true;
    await writeMeta(folder, meta);

    return res.json({ ok: true, favorite: meta[file].favorite });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

/* -----------------------------------------
    DOWNLOAD
------------------------------------------*/
router.get("/download/:name", async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat || "";

    const filePath = safeResolve(folder, file);

    if (!fsSync.existsSync(filePath))
      return res.status(404).send("File not found");

    return res.download(filePath, file);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message });
  }
});

/* -----------------------------------------
    USAGE MAP — where is this image used?
    GET /api/media/usage/:folder/:file
------------------------------------------*/
router.get("/usage/:folder/:file", async (req, res) => {
  try {
    const folder = decodeURIComponent(req.params.folder || "");
    const file = decodeURIComponent(req.params.file || "");

    const filePath = `uploads/${folder}/${file}`; // matches DB stored paths

    const results = {
      products: [],
      product_sub_images: [],
      categories: [],
      posts: [],
      banners: [],
      inUse: false,
    };

    // 1) product_table - search text fields that may include the filename
    try {
      results.products = await Product.find({
        $or: [
          { description: { $regex: file, $options: "i" } },
          { product_info: { $regex: file, $options: "i" } },
        ],
      }).select("product_name prod_id");
    } catch (err) {
      console.warn("Product lookup failed:", err.message || err);
      results.products = [];
    }

    // 2) product_sub_table - exact match on image_path
    try {
      results.product_sub_images = await ProductSub.find({
        image_path: filePath,
      }).select("PRODUCT_ID image_path");
    } catch (err) {
      console.warn("ProductSub lookup failed:", err.message || err);
      results.product_sub_images = [];
    }

    // 3) categories
    try {
      results.categories = await Category.find({
        category_image: filePath,
      }).select("category_name");
    } catch (err) {
      console.warn("Category lookup failed:", err.message || err);
      results.categories = [];
    }

    // 4) blog/posts
    try {
      results.posts = await Blog.find({
        image: filePath,
      }).select("title");
    } catch (err) {
      console.warn("Blog lookup failed:", err.message || err);
      results.posts = [];
    }

    // 5) banners
    try {
      results.banners = await Banner.find({
        $or: [{ image: filePath }, { mobileImage: filePath }],
      }).select("title");
    } catch (err) {
      console.warn("Banner lookup failed:", err.message || err);
      results.banners = [];
    }

    results.inUse =
      (results.products && results.products.length > 0) ||
      (results.product_sub_images && results.product_sub_images.length > 0) ||
      (results.categories && results.categories.length > 0) ||
      (results.posts && results.posts.length > 0) ||
      (results.banners && results.banners.length > 0);

    return res.json(results);
  } catch (err) {
    console.error("Usage lookup failed:", err);
    return res.status(500).json({ message: "Error checking image usage" });
  }
});

/* -----------------------------------------
    UPDATE METADATA
------------------------------------------*/
router.post("/meta/:name", express.json(), async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat || "";
    const filePath = safeResolve(folder, file);

    if (!fsSync.existsSync(filePath))
      return res.status(404).json({ message: "File not found" });

    const meta = await readMeta(folder);
    meta[file] = {
      title: req.body.title || file,
      alt: req.body.alt || "",
      caption: req.body.caption || "",
      description: req.body.description || "",
    };

    await writeMeta(folder, meta);

    return res.json({ ok: true, meta: meta[file] });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message });
  }
});

/* -----------------------------------------
    DELETE FILE (blocks when image is in use)
------------------------------------------*/
router.delete("/:name", async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat || "";

    // Check usage first (reuse logic)
    const decodedFolder = decodeURIComponent(folder);
    const decodedFile = decodeURIComponent(file);
    const filePath = `uploads/${decodedFolder}/${decodedFile}`;

    const out = { products: [], product_sub_images: [], categories: [], posts: [], banners: [], inUse: false };

    try {
      out.products = await Product.find({
        $or: [
          { description: { $regex: decodedFile, $options: "i" } },
          { product_info: { $regex: decodedFile, $options: "i" } },
        ],
      }).select("product_name prod_id");
    } catch { out.products = []; }

    try {
      out.product_sub_images = await ProductSub.find({ image_path: filePath }).select("PRODUCT_ID image_path");
    } catch { out.product_sub_images = []; }

    try {
      out.categories = await Category.find({ category_image: filePath }).select("category_name");
    } catch { out.categories = []; }

    try {
      out.posts = await Blog.find({ image: filePath }).select("title");
    } catch { out.posts = []; }

    try {
      out.banners = await Banner.find({ $or: [{ image: filePath }, { mobileImage: filePath }] }).select("title");
    } catch { out.banners = []; }

    out.inUse =
      (out.products && out.products.length > 0) ||
      (out.product_sub_images && out.product_sub_images.length > 0) ||
      (out.categories && out.categories.length > 0) ||
      (out.posts && out.posts.length > 0) ||
      (out.banners && out.banners.length > 0);

    if (out.inUse) {
      return res.status(400).json({ message: "Cannot delete: image in use", usage: out });
    }

    const abs = safeResolve(folder, file);
    if (!fsSync.existsSync(abs)) return res.status(404).json({ message: "File not found" });

    await fs.unlink(abs);

    // remove meta
    const meta = await readMeta(folder);
    delete meta[file];
    await writeMeta(folder, meta);

    return res.json({ ok: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message });
  }
});

export default router;
