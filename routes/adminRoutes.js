import express from "express";
import AdminTable from "../models/adminModel.js";


const router = express.Router();

// ✅ Admin login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("🟢 Login request:", username);

    const admin = await AdminTable.findOne({ username });
    if (!admin) return res.status(400).json({ success: false, message: "Invalid username" });

    if (admin.password !== password)
      return res.status(400).json({ success: false, message: "Invalid password" });

    res.json({
      success: true,
      message: "Login successful",
      admin: { username: admin.username, email: admin.email },
    });
  } catch (error) {
    console.error("❌ Error in login:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Seed an admin (temporary)
router.post("/seed", async (req, res) => {
  try {
    const existing = await AdminTable.findOne({ username: "admin" });
    if (existing) return res.status(400).json({ message: "⚠️ Admin already exists" });

    const newAdmin = new AdminTable({
      username: "admin",
      email: "admin@example.com",
      password: "123456",
    });

    await newAdmin.save();
    res.status(201).json({ message: "✅ Admin created successfully" });
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



// ✅ Update Admin Username / Password
router.post("/update", async (req, res) => {
  try {
    const { currentUsername, newUsername, newPassword } = req.body;

    if (!currentUsername) {
      return res.status(400).json({ success: false, message: "Current username required" });
    }

    const admin = await AdminTable.findOne({ username: currentUsername });
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (newUsername) admin.username = newUsername;
    if (newPassword) admin.password = newPassword;

    await admin.save();

    res.json({ success: true, message: "✅ Account updated successfully" });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




export default router;
