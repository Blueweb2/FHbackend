// mediaRoutes.js
import express from "express";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

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

// Each category has: /uploads/<category>/media.meta.json
async function metaFilePath(folder) {
  return path.join(UPLOAD_DIR, folder || "", "media.meta.json");
}

async function readMeta(folder) {
  const file = await metaFilePath(folder);

  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch {
    return {}; // no meta yet
  }
}

async function writeMeta(folder, meta) {
  const file = await metaFilePath(folder);
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
    GET /api/media  (pagination + search + filter)
------------------------------------------*/
router.get("/api/media", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 40;
    const search = (req.query.search || "").toLowerCase();
    const category = req.query.category || "all";

    const folder = categoryFolders[category];

    const baseDir = folder ? path.join(UPLOAD_DIR, folder) : UPLOAD_DIR;

    let files = await fs.readdir(baseDir);

    // Remove hidden files
    files = files.filter(
      (f) => !f.startsWith(".") && f !== "media.meta.json"
    );

    const meta = await readMeta(folder);

    // Search filter
    if (search) {
      files = files.filter((file) => {
        const m = meta[file] || {};
        return (
          file.toLowerCase().includes(search) ||
          (m.title || "").toLowerCase().includes(search) ||
          (m.caption || "").toLowerCase().includes(search) ||
          (m.description || "").toLowerCase().includes(search)
        );
      });
    }

    // Pagination
    const total = files.length;
    const start = (page - 1) * limit;
    const currentFiles = files.slice(start, start + limit);

    // Response items
    const items = currentFiles.map((file) => ({
      name: file,
      folder: folder || "",
      url: `/uploads/${folder ? folder + "/" : ""}${file}`,
      downloadUrl: `/api/media/download/${file}?cat=${folder || ""}`,
      meta: meta[file] || {
        title: file,
        alt: "",
        caption: "",
        description: "",
      },
    }));

    return res.json({
      total,
      items,
      page,
      limit,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error loading media" });
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
    DELETE FILE
------------------------------------------*/
router.delete("/:name", async (req, res) => {
  try {
    const file = req.params.name;
    const folder = req.query.cat || "";

    const filePath = safeResolve(folder, file);

    if (!fsSync.existsSync(filePath))
      return res.status(404).json({ message: "File not found" });

    await fs.unlink(filePath);

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
