import express from "express";
import multer from "multer";
import fs from "fs";
import Product_table from "../models/productModel.js";
import ProductImageTable from "../models/productImage.js";

const router = express.Router();


/* ============================================================
   🧱 Multer Configuration for Product Images
============================================================ */
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "/var/www/uploads/products";
  
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const uploadProductImage = multer({ storage: productStorage });
// const storage = multer.memoryStorage(); // <--- store in memory not disk
// const upload = multer({ storage });



// fetch 10 latest product to user featured product 
router.get("/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product_table.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("CAT_ID", "category_name")
      .lean();

    const productsWithImages = await Promise.all(
      products.map(async (product) => {
        let mainImage = await ProductImageTable.findOne({
          PRODUCT_ID: product._id,
          is_main: true,
        });

        // If no main image found, pick the first uploaded image
        if (!mainImage) {
          mainImage = await ProductImageTable.findOne({ PRODUCT_ID: product._id }).sort({
            _id: -1,
          });
        }

        return {
          _id: product._id,
          prod_id: product.prod_id,
          product_name: product.product_name,
          description: product.description,
          product_info: product.product_info || "",
          category: product.CAT_ID?.category_name || "Uncategorized",
          main_image: mainImage ? mainImage.image_path : null, // ✅ attach image
        };
      })
    );

    res.json({ success: true, products: productsWithImages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/userview", async (req, res) => {
  try {
    // Get all products
    const products = await Product_table.find()
      .populate("CAT_ID", "category_name")
      .lean();

    // For each product, find the main image or first image
    const productsWithMainImage = await Promise.all(
      products.map(async (product) => {
        // Find the main image for this product
        let mainImage = await ProductImageTable.findOne({
          PRODUCT_ID: product._id,
          is_main: true,
        });

        // If no main image found, pick the first uploaded image
        if (!mainImage) {
          mainImage = await ProductImageTable.findOne({ PRODUCT_ID: product._id }).sort({
            _id: -1,
          });
        }

        return {
          _id: product._id,
          prod_id: product.prod_id,
          product_name: product.product_name,
          description: product.description,
          product_info: product.product_info || "",
          category: product.CAT_ID?.category_name || "Uncategorized",
          main_image: mainImage ? mainImage.image_path : null, // ✅ attach image
        };
      })
    );

    res.status(200).json({
      success: true,
      products: productsWithMainImage,
    });
  } catch (error) {
    console.error("❌ Error fetching products for userview:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
});


// ✅ Get products by category
// ✅ Get products by category name
router.get("/category/:categoryName", async (req, res) => {
  try {
    const { categoryName } = req.params;

    // Step 1️⃣: Fetch all products and populate category
    const products = await Product_table.find()
      .populate("CAT_ID", "category_name")
      .lean();

    // Step 2️⃣: Filter products that match the given category name
    const matchedProducts = products.filter(
      (p) =>
        p.CAT_ID?.category_name?.toLowerCase() ===
        categoryName.toLowerCase()
    );

    // Step 3️⃣: Attach main image like in /userview
    const productsWithImage = await Promise.all(
      matchedProducts.map(async (product) => {
        let mainImg =
          (await ProductImageTable.findOne({
            PRODUCT_ID: product._id,
            is_main: true,
          })) ||
          (await ProductImageTable.findOne({ PRODUCT_ID: product._id }));

        return {
          _id: product._id,
          prod_id: product.prod_id,
          product_name: product.product_name,
          description: product.description,
          category: product.CAT_ID?.category_name || "Uncategorized",
          main_image: mainImg ? mainImg.image_path : null,
        };
      })
    );

    res.json({
      success: true,
      category: categoryName,
      products: productsWithImage,
    });
  } catch (error) {
    console.error("❌ Error fetching category products:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while fetching category products" });
  }
});


// ✅ USER-FACING: Fetch single product details by ID
// ✅ USER-FACING: Fetch single product details by ID
// ✅ USER-FACING: Fetch single product details by ID
router.get("/userview/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 🧱 Step 1: Fetch the product document
    const product = await Product_table.findById(id)
      .populate("CAT_ID", "category_name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 🧱 Step 2: Fetch all images linked to the product
    const images = await ProductImageTable.find({ PRODUCT_ID: id });

    // Separate main image & others
    const mainImg = images.find((img) => img.is_main);
    const otherImages = images.filter((img) => !img.is_main);

    // 🧱 Step 3: Ensure correct base URL (e.g., http://localhost:5000/)
    const baseUrl = `${req.protocol}://${req.get("host")}/`;

    // 🧱 Step 4: Build structured response object
    const productDetails = {
      _id: product._id,
      prod_id: product.prod_id,
      name: product.product_name,
      description: product.description,
      product_info: product.product_info || "",
      category: product.CAT_ID?.category_name || "Uncategorized",

      // ✅ Build complete URLs for images
      main_image: mainImg ? `${baseUrl}${mainImg.image_path}` : null,
      gallery: otherImages.map((img) => `${baseUrl}${img.image_path}`),
    };

    // 🧱 Step 5: Send clean structured response
    return res.status(200).json({
      success: true,
      product: productDetails,
    });

  } catch (error) {
    console.error("❌ Error fetching single product:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching product details",
    });
  }
});



// // ✅ Then your single product route
// router.get("/:id", async (req, res) => {
//   try {
//     const product = await Product_table.findById(req.params.id);
//     res.json({ success: true, product });
//   } catch (error) {
//     console.error("❌ Error fetching product:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });




// Get images of a product
router.get("/images/:productId", async (req, res) => {
  try {
    const images = await ProductImageTable.find({
      PRODUCT_ID: req.params.productId,
    });
    res.json({ success: true, images });
  } catch (error) {
    console.error("❌ Error fetching images:", error);
    res.status(500).json({ success: false, message: "Server error while fetching images" });
  }
});

// Set main image
router.put("/setMainImage/:imageId", async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await ProductImageTable.findById(imageId);
    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    await ProductImageTable.updateMany(
      { PRODUCT_ID: image.PRODUCT_ID },
      { $set: { is_main: false } }
    );

    image.is_main = true;
    await image.save();

    res.status(200).json({
      success: true,
      message: "Main image updated successfully",
      image,
    });
  } catch (error) {
    console.error("❌ Error setting main image:", error);
    res.status(500).json({ success: false, message: "Server error while setting main image" });
  }
});





/* ============================================================
   ✅ 1. Add Product
============================================================ */
router.post("/add", async (req, res) => {
  try {
    const { prod_id, product_name, CAT_ID, description, product_info } = req.body;
    if (!prod_id || !product_name || !CAT_ID || !description) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }

    const newProduct = new Product_table({
      prod_id,
      product_name,
      CAT_ID,
      description,
      product_info,
    });

    await newProduct.save();
    res.status(201).json({ success: true, message: "✅ Product added successfully", product: newProduct });
  } catch (error) {
    console.error("❌ Error adding product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//



// router.post("/add", upload.single("image"), async (req, res) => {
//   try {
//     const { prod_id, product_name, CAT_ID, description, product_info } = req.body;

//     if (!prod_id || !product_name || !CAT_ID || !description) {
//       return res.status(400).json({
//         success: false,
//         message: "All required fields must be filled",
//       });
//     }

//     let webpImagePath = null;

//     // If image uploaded → convert to WEBP
//     if (req.file) {
//       const uploadsDir = "uploads/products";

//       if (!fs.existsSync(uploadsDir)) {
//         fs.mkdirSync(uploadsDir, { recursive: true });
//       }

//       // Generate unique filename
//       const filename = `${Date.now()}.webp`;
//       webpImagePath = path.join(uploadsDir, filename);

//       // Convert using Sharp
//       await sharp(req.file.buffer)
//         .webp({ quality: 80 })
//         .toFile(webpImagePath);
//     }

//     // Create product
//     const newProduct = new Product_table({
//       prod_id,
//       product_name,
//       CAT_ID,
//       description,
//       product_info,
//       image: webpImagePath, // store converted webp
//     });

//     await newProduct.save();

//     res.status(201).json({
//       success: true,
//       message: "✅ Product added successfully",
//       product: newProduct,
//     });

//   } catch (error) {
//     console.error("❌ Error adding product:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });
/* ============================================================
   ✅ 2. Upload Product Images
============================================================ */
router.post("/upload-images/:PRODUCT_ID", (req, res) => {
  const multipleUpload = uploadProductImage.array("images", 10);

  multipleUpload(req, res, async (err) => {
    if (err) {
      console.error("Multer error while uploading product images:", err);
      return res.status(400).json({ success: false, message: err.message || "File upload error", code: err.code || null });
    }

    try {
      const { PRODUCT_ID } = req.params;
      const { mainIndex } = req.body;
      const files = req.files;

      if (!files || files.length === 0)
        return res.status(400).json({ success: false, message: "No images uploaded" });

      const imageDocs = files.map((file, index) => ({
        PRODUCT_ID,
        image_path: `uploads/products/${file.filename}`,
        is_main: parseInt(mainIndex) === index,
      }));

      await ProductImageTable.insertMany(imageDocs);
      res.json({ success: true, message: "✅ Images uploaded successfully" });
    } catch (error) {
      console.error("❌ Error uploading product images:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });
});

/* ============================================================
   ✅ 3. View All Products
============================================================ */
router.get("/viewallProducts", async (req, res) => {
  try {
    const products = await Product_table.find()
      .populate("CAT_ID", "category_name")
      .sort({ date: -1 })
      .lean();

    for (let p of products) {
      const mainImg =
        (await ProductImageTable.findOne({ PRODUCT_ID: p._id, is_main: true })) ||
        (await ProductImageTable.findOne({ PRODUCT_ID: p._id }));

      p.main_image = mainImg ? mainImg.image_path : null;
    }

    res.json({ success: true, products });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ============================================================
   ✅ 4. View Products by Category
============================================================ */
router.post("/view-by-category", async (req, res) => {
  try {
    const { CAT_ID } = req.body;

    if (!CAT_ID) {
      return res.status(400).json({ success: false, message: "Category ID is required" });
    }

    const products = await Product_table.find({ CAT_ID })
      .populate("CAT_ID", "category_name")
      .lean();

    for (let p of products) {
      const mainImg =
        (await ProductImageTable.findOne({ PRODUCT_ID: p._id, is_main: true })) ||
        (await ProductImageTable.findOne({ PRODUCT_ID: p._id }));

      p.main_image = mainImg ? mainImg.image_path : null;
    }

    res.json({ success: true, products });
  } catch (error) {
    console.error("❌ Error fetching products by category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ============================================================
   ✅ 5. Search Products (by name or category)
============================================================ */
router.post("/searchProducts", async (req, res) => {
  try {
    const { product_name, CAT_ID } = req.body;

    // If category filter is applied
    let query = {};
    if (product_name) query.product_name = { $regex: product_name, $options: "i" };
    if (CAT_ID) query.CAT_ID = CAT_ID;

    const products = await Product_table.find(query)
      .populate("CAT_ID", "category_name")
      .lean();

    for (let p of products) {
      const mainImg =
        (await ProductImageTable.findOne({ PRODUCT_ID: p._id, is_main: true })) ||
        (await ProductImageTable.findOne({ PRODUCT_ID: p._id }));

      p.main_image = mainImg ? mainImg.image_path : null;
    }

    res.json({ success: true, products });
  } catch (error) {
    console.error("❌ Error searching products:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ============================================================
   ✅ 6. Delete Product
============================================================ */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id)
      return res.status(400).json({ success: false, message: "Product ID required" });

    const product = await Product_table.findById(id);
    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    // Delete product images
    const images = await ProductImageTable.find({ PRODUCT_ID: id });
    for (const img of images) {
      if (img.image_path && fs.existsSync(img.image_path)) {
        fs.unlinkSync(img.image_path);
      }
    }

    await ProductImageTable.deleteMany({ PRODUCT_ID: id });
    await Product_table.findByIdAndDelete(id);

    res.json({ success: true, message: "✅ Product deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Get Single Product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product_table.findById(req.params.id)
      .populate("CAT_ID", "category_name")
      .lean();

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    // Fetch associated images
    const images = await ProductImageTable.find({ PRODUCT_ID: req.params.id });
    product.images = images;

    res.json({ success: true, product });
  } catch (error) {
    console.error("❌ Error fetching product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Update Product Details
router.put("/update/:id", async (req, res) => {
  try {
    const { prod_id, product_name, CAT_ID, description, product_info } = req.body;

    const updatedProduct = await Product_table.findByIdAndUpdate(
      req.params.id,
      { prod_id, product_name, CAT_ID, description, product_info },
      { new: true }
    );

    if (!updatedProduct)
      return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, message: "✅ Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});







// ✅ Fetch all active products for user view
router.get("/view", async (req, res) => {
  try {
    const products = await Product_table.find({ status: "active" }) // only active products
      .populate("CAT_ID", "category_name")
      .lean();

    const productsWithImage = await Promise.all(
      products.map(async (p) => {
        const mainImg =
          (await ProductImageTable.findOne({
            PRODUCT_ID: p._id,
            is_main: true,
          })) ||
          (await ProductImageTable.findOne({ PRODUCT_ID: p._id }));

        return {
          _id: p._id,
          name: p.name,
          description: p.description,
          category: p.CAT_ID?.category_name,
          main_image: mainImg?.filename || null,
        };
      })
    );

    res.json({ success: true, products: productsWithImage });
  } catch (error) {
    console.error("❌ Error fetching user products:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error fetching products" });
  }
});





export default router;
