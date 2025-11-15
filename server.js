import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import adminRoutes from "./routes/adminRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js"

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
const app = express();

// ✅ Middleware
// app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(cors({
  origin: ["http://localhost:3000", "https://fhgeneralequipments.com"],
  credentials: true
}));

app.use(express.json());

// // app.use("/uploads", express.static("uploads"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// app.use('/uploads', express.static('/var/www/uploads'))
// Serve uploads folder correctly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.log("❌ MongoDB connection error:", err));
// import connectDB from "./db.js";
// connectDB();



app.get("/", (req, res) => {
  res.send("🚀 Backend server running...");
});

// ✅ Routes
app.use("/api/admin", adminRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/product", productRoutes); // <-- make sure it's plural!
app.use("/api/banners", bannerRoutes);
// app.use("/api/contact", contactRoutes);



// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`⚡ Server running on port ${PORT}`));
