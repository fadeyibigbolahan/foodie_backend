const express = require("express");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const router = express.Router();

// router.post("/withdraw", async (req, res) => {
//   try {
//     const { username, amount } = req.body;
//     let user = await User.findOne({ username });
//     if (!user) return res.status(404).json({ message: "User not found" });

//     if (user.earnings < amount)
//       return res.status(400).json({ message: "Insufficient balance" });

//     user.earnings -= amount;
//     user.totalWithdrawals += amount;
//     await user.save();

//     // Log withdrawal transaction
//     await Transaction.create({
//       user: user._id,
//       type: "withdrawal",
//       amount: amount,
//       balanceAfter: user.earnings,
//       details: "User withdrawal request",
//     });

//     res.status(200).json({ message: "Withdrawal successful", user });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// });

router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const transactions = await Transaction.find({ user: user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/user-summary/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      earnings: user.earnings,
      totalEarnings: user.totalEarnings,
      totalWithdrawals: user.totalWithdrawals,
      monthlyBV: user.monthlyBV,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
