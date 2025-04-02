const express = require("express");
const PackageCode = require("../models/PackageCode");
const Package = require("../models/Package");
const router = express.Router();
const crypto = require("crypto");

// Admin generates package codes
router.post("/generate-code", async (req, res) => {
  try {
    const { packageId, quantity } = req.body;

    // Check if package exists
    const selectedPackage = await Package.findById(packageId);
    if (!selectedPackage)
      return res.status(400).json({ message: "Invalid package ID" });

    let codes = [];

    for (let i = 0; i < quantity; i++) {
      // Generate a random 10-character code
      const generatedCode = crypto.randomBytes(5).toString("hex").toUpperCase();

      // Save to database
      const newCode = new PackageCode({
        code: generatedCode,
        package: packageId,
        assignedTo: null, // Not yet used
      });

      await newCode.save();
      codes.push(generatedCode);
    }

    res
      .status(201)
      .json({ message: "Package codes generated successfully", codes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
