const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Recursive function to build genealogy tree
const getDownline = async (username) => {
  // console.log("username", username);
  const directReferrals = await User.find({ referredBy: username });
  // console.log("downline", directReferrals);

  // Recursively get each referral's downline
  const downlineWithReferrals = await Promise.all(
    directReferrals.map(async (user) => ({
      ...user.toObject(),
      downline: await getDownline(user.username),
    }))
  );

  return downlineWithReferrals;
};

// API endpoint to fetch full genealogy tree
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const downline = await getDownline(user.username);
    res.json({ user, downline });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
