const express = require("express");
const Package = require("../models/Package");
const Transaction = require("../models/Transaction");
const distributeCommission = require("../utils/distributeCommission");
const createNotification = require("../utils/createNotification");
const User = require("../models/User");
const { userAuth } = require("../utils/Auth");
const router = express.Router();

// Admin adds new MLM package
router.post("/add-package", async (req, res) => {
  try {
    const { name, price, bv, commissionLevels } = req.body;

    // Check if package already exists
    const existingPackage = await Package.findOne({ name });
    if (existingPackage)
      return res.status(400).json({ message: "Package already exists" });

    // Create new package
    const newPackage = new Package({
      name,
      price,
      bv,
      commissionLevels, // Example: [{ level: 1, percentage: 20 }, { level: 2, percentage: 10 }]
    });

    await newPackage.save();
    res
      .status(201)
      .json({ message: "Package added successfully", package: newPackage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all packages
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find(); // Fetch all packages
    res.status(200).json(packages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch packages", error });
  }
});

router.put("/upgrade-package", userAuth, async (req, res) => {
  try {
    const { newPackageId } = req.body;
    const userId = req.user.id;

    let user = await User.findById(userId).populate("package");
    if (!user) return res.status(404).json({ message: "User not found" });

    let newPackage = await Package.findById(newPackageId);
    if (!newPackage)
      return res.status(400).json({ message: "Invalid package" });

    if (user.package && user.package.price >= newPackage.price) {
      return res
        .status(400)
        .json({ message: "Upgrade must be to a higher package" });
    }

    const upgradeCost =
      newPackage.price - (user.package ? user.package.price : 0);

    if (user.earnings < upgradeCost) {
      return res
        .status(400)
        .json({ message: "Insufficient balance for upgrade" });
    }

    // Calculate rewards
    const previousPackage = user.package;
    const bvDifference = newPackage.bv - (previousPackage?.bv || 0);
    const cashReward = (upgradeCost * 20) / 100;

    // Apply upgrades
    user.earnings -= upgradeCost;
    user.package = newPackage;

    // Apply upgrade benefits
    user.earnings += cashReward;
    user.totalEarnings += cashReward;
    user.bv += bvDifference;
    user.monthlyBV += bvDifference;

    await user.save();

    // Distribute referral commission
    await distributeCommission(user.username, true, previousPackage);

    // Log the upgrade transaction
    await Transaction.create({
      user: user._id,
      type: "package-upgrade",
      amount: upgradeCost,
      balanceAfter: user.earnings,
      details: `Package upgrade from ${previousPackage.name} to ${newPackage.name}`,
    });

    await createNotification(
      user._id,
      `You upgraded your package from ${previousPackage.name} to ${newPackage.name}.`
    );

    // Log the reward
    await Transaction.create({
      user: user._id,
      type: "upgrade-reward",
      amount: cashReward,
      balanceAfter: user.creditWallet,
      details: `20% reward for upgrading package from ${previousPackage.name} to ${newPackage.name}`,
    });

    await createNotification(
      user._id,
      `You received ₦${cashReward.toFixed(2)} for upgrading your package.`
    );

    res.status(200).json({
      message: "Package upgraded successfully",
      user,
      reward: {
        cash: cashReward,
        bv: bvDifference,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// router.put("/upgrade-package", userAuth, async (req, res) => {
//   try {
//     const { newPackageId } = req.body;
//     const userId = req.user.id;

//     let user = await User.findById(userId).populate("package");
//     if (!user) return res.status(404).json({ message: "User not found" });

//     let newPackage = await Package.findById(newPackageId);
//     if (!newPackage)
//       return res.status(400).json({ message: "Invalid package" });

//     // Ensure the new package is an upgrade
//     if (user.package && user.package.price >= newPackage.price) {
//       return res
//         .status(400)
//         .json({ message: "Upgrade must be to a higher package" });
//     }

//     // Deduct or charge user if necessary
//     const upgradeCost =
//       newPackage.price - (user.package ? user.package.price : 0);

//     // Here, you should integrate your payment method if required
//     // Example: Check if the user has enough balance
//     if (user.earnings < upgradeCost) {
//       return res
//         .status(400)
//         .json({ message: "Insufficient balance for upgrade" });
//     }

//     user.earnings -= upgradeCost; // Deduct from earnings
//     user.package = newPackage; // Assign new package
//     await user.save();

//     await distributeCommission(user.username, true, previousPackage);

//     res.status(200).json({ message: "Package upgraded successfully", user });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

module.exports = router;
