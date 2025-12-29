import fs from "fs";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = "/var/www/uploads";

async function convertDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await convertDir(fullPath);
      continue;
    }

    if (!/\.(jpg|jpeg|png)$/i.test(entry.name)) continue;

    const webpPath = fullPath.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    if (fs.existsSync(webpPath)) continue;

    await sharp(fullPath).webp({ quality: 82 }).toFile(webpPath);
    console.log("✔ Converted:", webpPath);
  }
}

convertDir(UPLOAD_DIR)
  .then(() => console.log("🎉 Uploads converted to WebP"))
  .catch(console.error);
