// mediaRoutes.js  — REPLACE your file with this version
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
  // if folder doesn't exist, return empty
  try {
    const names = await fs.readdir(dir);
    // filter out hidden / meta file
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
      // read all specifically defined categories (exclude 'all' key)
      foldersToRead = Object.keys(categoryFolders).filter((k) => k !== "all");
    } else {
      if (!categoryFolders[category]) {
        return res.status(400).json({ message: "Invalid category" });
      }
      foldersToRead = [category];
    }

    // gather file entries from each folder
    let entries = []; // { name, folder }
    for (const catKey of foldersToRead) {
      const folderName = categoryFolders[catKey];
      const files = await listFilesInFolder(folderName);
      for (const f of files) {
        entries.push({
          name: f,
          folder: folderName || "",
          catKey, // e.g. 'products' (useful if needed)
        });
      }
    }

    // read metas per-folder
    // Build a map: metaMap[folder][filename] => meta
    const metaMap = {};
    for (const catKey of foldersToRead) {
      const folderName = categoryFolders[catKey];
      metaMap[folderName || ""] = await readMeta(folderName);
    }

    // Search filter (search filename or metadata)
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

    // Sort: favorite first (across folders). If meta missing, treat as false.
    entries.sort((a, b) => {
      const ma = (metaMap[a.folder] && metaMap[a.folder][a.name] && metaMap[a.folder][a.name].favorite) ? 1 : 0;
      const mb = (metaMap[b.folder] && metaMap[b.folder][b.name] && metaMap[b.folder][b.name].favorite) ? 1 : 0;
      return mb - ma;
    });

    const total = entries.length;
    const start = (page - 1) * limit;
    const pageEntries = entries.slice(start, start + limit);

    // Build response items
    const items = pageEntries.map((entry) => {
      const meta = metaMap[entry.folder] && metaMap[entry.folder][entry.name] ? metaMap[entry.folder][entry.name] : {
        title: entry.name,
        alt: "",
        caption: "",
        description: "",
      };

      return {
        name: entry.name,
        folder: entry.folder, // empty string for root (shouldn't be used here)
        url: `/uploads/${entry.folder ? entry.folder + "/" : ""}${entry.name}`,
        downloadUrl: `/api/media/download/${encodeURIComponent(entry.name)}?cat=${encodeURIComponent(entry.folder || "")}`,
        meta,
      };
    });

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
    FAVORITE toggle (unchanged)
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
    DOWNLOAD (unchanged)
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
    UPDATE METADATA (unchanged)
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
    DELETE FILE (unchanged)
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
