// ⚠️ ONE-TIME MIGRATION SCRIPT
// DO NOT RUN AGAIN
// Used for WebP migration (Dec 2025)
import mongoose from "mongoose";

import Product from "../models/productModel.js";
import ProductImage from "../models/productImage.js";
import Category from "../models/categoryModel.js";
import Blog from "../models/postModel.js";
import Banner from "../models/Banner.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fhgeneral";

function replaceToWebp(value) {
  if (!value) return value;
  return value.replace(/\.(jpg|jpeg|png)/gi, ".webp");
}

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  /* PRODUCTS (HTML fields) */
  const products = await Product.find({});
  for (const p of products) {
    let changed = false;

    if (p.description) {
      const d = replaceToWebp(p.description);
      if (d !== p.description) {
        p.description = d;
        changed = true;
      }
    }

    if (p.product_info) {
      const i = replaceToWebp(p.product_info);
      if (i !== p.product_info) {
        p.product_info = i;
        changed = true;
      }
    }

    if (changed) {
      await p.save();
      console.log("✔ Product updated:", p._id);
    }
  }

  /* PRODUCT SUB IMAGES */
  await ProductImage.updateMany(
    { image_path: { $regex: /\.(jpg|jpeg|png)$/i } },
    [{ $set: { image_path: { $replaceAll: { input: "$image_path", find: ".jpg", replacement: ".webp" } } } }]
  );

  /* CATEGORIES */
  const categories = await Category.find({});
  for (const c of categories) {
    const updated = replaceToWebp(c.category_image);
    if (updated !== c.category_image) {
      c.category_image = updated;
      await c.save();
      console.log("✔ Category updated:", c._id);
    }
  }

  /* BLOGS */
  const blogs = await Blog.find({});
  for (const b of blogs) {
    const updated = replaceToWebp(b.image);
    if (updated !== b.image) {
      b.image = updated;
      await b.save();
      console.log("✔ Blog updated:", b._id);
    }
  }

  /* BANNERS */
  const banners = await Banner.find({});
  for (const b of banners) {
    let changed = false;

    const img = replaceToWebp(b.image);
    const mob = replaceToWebp(b.mobileImage);

    if (img !== b.image) {
      b.image = img;
      changed = true;
    }
    if (mob !== b.mobileImage) {
      b.mobileImage = mob;
      changed = true;
    }

    if (changed) {
      await b.save();
      console.log("✔ Banner updated:", b._id);
    }
  }

  console.log("🎉 DATABASE IMAGE MIGRATION COMPLETED");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed", err);
  process.exit(1);
});
