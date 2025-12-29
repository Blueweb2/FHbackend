// routes/mediaRoutes.js
import express from "express";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import multer from "multer";


// Correct Models
import Product_table from "../models/productModel.js";
import ProductImageTable from "../models/productImage.js";
import Category_table from "../models/categoryModel.js";
import Blog_table from "../models/postModel.js";
import BannerTable from "../models/Banner.js";

const router = express.Router();
const UPLOAD_DIR = "/var/www/uploads";

// category → folder mapping
const categoryFolders = {
  products: "products",
  posts: "posts",          // ✔ Correct
  banners: "banners",
  categories: "categories",
  all: "",
};

/* ------------------------------------------
   Metadata Helpers
-------------------------------------------*/
function metaFilePath(folder) {
  return path.join(UPLOAD_DIR, folder || "", "media.meta.json");
}

async function readMeta(folder) {
  try {
    return JSON.parse(await fs.readFile(metaFilePath(folder), "utf8"));
  } catch {
    return {};
  }
}

async function writeMeta(folder, meta) {
  const file = metaFilePath(folder);
  const dir = path.dirname(file);
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(meta, null, 2));
}

/* ------------------------------------------
   Path traversal protection
-------------------------------------------*/
function safeResolve(folder, filename) {
  const resolved = path.normalize(path.join(UPLOAD_DIR, folder || "", filename));
  if (!resolved.startsWith(UPLOAD_DIR)) throw new Error("Invalid path");
  return resolved;
}

/* ------------------------------------------
   List files in folder
-------------------------------------------*/
async function listFilesInFolder(folder) {
  const dir = folder ? path.join(UPLOAD_DIR, folder) : UPLOAD_DIR;
  try {
    const names = await fs.readdir(dir);
    return names.filter(
      (n) => !n.startsWith(".") && n !== "media.meta.json"
    );
  } catch {
    return [];
  }
}

/* ------------------------------------------
    GET /api/media
-------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 40;
    const search = (req.query.search || "").toLowerCase();
    const category = req.query.category || "all";

    let foldersToRead =
      category === "all"
        ? Object.keys(categoryFolders).filter((k) => k !== "all")
        : [category];

    let entries = [];

    for (const catKey of foldersToRead) {
      const folderName = categoryFolders[catKey];
      const files = await listFilesInFolder(folderName);
      files.forEach((file) =>
        entries.push({ name: file, folder: folderName, catKey })
      );
    }

    const metaMap = {};
    for (const catKey of foldersToRead) {
      const folderName = categoryFolders[catKey];
      metaMap[folderName] = await readMeta(folderName);
    }

    // Search filter
    if (search) {
      entries = entries.filter((e) => {
        const m = metaMap[e.folder][e.name] || {};
        return (
          e.name.toLowerCase().includes(search) ||
          (m.title || "").toLowerCase().includes(search) ||
          (m.caption || "").toLowerCase().includes(search) ||
          (m.description || "").toLowerCase().includes(search)
        );
      });
    }

    // Sort favorites first
    entries.sort((a, b) => {
      const fa = metaMap[a.folder][a.name]?.favorite ? 1 : 0;
      const fb = metaMap[b.folder][b.name]?.favorite ? 1 : 0;
      return fb - fa;
    });

    const total = entries.length;
    const start = (page - 1) * limit;
    const items = entries.slice(start, start + limit).map((e) => ({
      name: e.name,
      folder: e.folder,
      url: `/uploads/${e.folder}/${e.name}`,
      downloadUrl: `/api/media/download/${e.name}?cat=${e.folder}`,
      meta: metaMap[e.folder][e.name] || {
        title: e.name,
        alt: "",
        caption: "",
        description: "",
      },
    }));

    res.json({ total, items, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error loading media" });
  }
});

/* ------------------------------------------
    UPLOAD
-------------------------------------------*/
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = req.query.cat || "products";
    const savePath = path.join(UPLOAD_DIR, folder);
    if (!fsSync.existsSync(savePath))
      fsSync.mkdirSync(savePath, { recursive: true });
    cb(null, savePath);
  },
  filename(req, file, cb) {
    const cleaned = file.originalname.replace(/\s+/g, "-");
    cb(null, Date.now() + "-" + cleaned);
  },
});

const upload = multer({ storage });

router.post("/upload", upload.array("media"), async (req, res) => {
  try {
    const folder = req.query.cat || "products";
    const meta = await readMeta(folder);

    req.files.forEach((f) => {
      meta[f.filename] = {
        title: f.filename,
        alt: "",
        caption: "",
        description: "",
      };
    });

    await writeMeta(folder, meta);

    res.json({ ok: true, uploaded: req.files.map((f) => f.filename) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

/* ------------------------------------------
    FAVORITE
-------------------------------------------*/
router.post("/favorite/:name", express.json(), async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat;
    const meta = await readMeta(folder);

    meta[file] = meta[file] || {};
    meta[file].favorite = req.body.favorite === true;

    await writeMeta(folder, meta);
    res.json({ ok: true, favorite: meta[file].favorite });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ------------------------------------------
    DOWNLOAD
-------------------------------------------*/
router.get("/download/:name", async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat;
    const abs = safeResolve(folder, file);

    if (!fsSync.existsSync(abs))
      return res.status(404).send("File not found");

    res.download(abs, file);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ------------------------------------------
    USAGE CHECK
-------------------------------------------*/
router.get("/usage/:folder/:file", async (req, res) => {
  try {
    const folder = req.params.folder;
    const file = req.params.file;
    const filePath = `uploads/${folder}/${file}`;

    const results = {
      products: [],
      product_sub_images: [],
      categories: [],
      posts: [],
      banners: [],
    };

    results.products = await Product_table.find({
      $or: [
        { description: { $regex: file, $options: "i" } },
        { product_info: { $regex: file, $options: "i" } },
      ],
    }).select("product_name prod_id");

    results.product_sub_images = await ProductImageTable.find({
      image_path: filePath,
    }).select("PRODUCT_ID image_path");

    results.categories = await Category_table.find({
      category_image: filePath,
    }).select("category_name");

    results.posts = await Blog_table.find({
      image: filePath,
    }).select("title");

    results.banners = await BannerTable.find({
      $or: [{ image: filePath }, { mobileImage: filePath }],
    }).select("title");

    results.inUse =
      results.products.length ||
      results.product_sub_images.length ||
      results.categories.length ||
      results.posts.length ||
      results.banners.length;

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Usage check failed" });
  }
});

/* ------------------------------------------
    DELETE (with usage check)
-------------------------------------------*/
router.delete("/:name", async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat;

    const filePath = `uploads/${folder}/${file}`;

    // check usage
    const usage = {
      products: await Product_table.find({
        $or: [
          { description: { $regex: file, $options: "i" } },
          { product_info: { $regex: file, $options: "i" } },
        ],
      }),
      product_sub_images: await ProductImageTable.find({
        image_path: filePath,
      }),
      categories: await Category_table.find({ category_image: filePath }),
      posts: await Blog_table.find({ image: filePath }),
      banners: await BannerTable.find({
        $or: [{ image: filePath }, { mobileImage: filePath }],
      }),
    };

    const inUse =
      usage.products.length ||
      usage.product_sub_images.length ||
      usage.categories.length ||
      usage.posts.length ||
      usage.banners.length;

    if (inUse)
      return res.status(400).json({
        message: "Cannot delete: image is in use",
        usage,
      });

    // delete file physically
    const abs = safeResolve(folder, file);
    if (fsSync.existsSync(abs)) await fs.unlink(abs);

    // delete from meta
    const meta = await readMeta(folder);
    delete meta[file];
    await writeMeta(folder, meta);

    res.json({ ok: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

export default router;
