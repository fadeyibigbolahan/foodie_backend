const express = require("express");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { userAuth, checkRole } = require("../utils/Auth");
const router = express.Router();
const Withdrawal = require("../models/Withdrawal"); // Assuming you have a Withdrawal model
const createNotification = require("../utils/createNotification");
const moment = require("moment"); // For date manipulation

router.post("/withdrawal", userAuth, async (req, res) => {
  try {
    const userId = req.user._id; // User ID from authenticated request
    const { amount, accountDetails } = req.body;
    console.log("withdrawal", amount, accountDetails);

    // Fetch the user's current balance (earnings)
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user's earnings are at least 5000
    if (amount < 5000) {
      return res.status(400).json({
        message: "Minimum withdrawal amount is 5000 NGN.",
      });
    }

    // Check if the user's earnings are at least 5000
    if (user.earnings < 5000) {
      return res.status(400).json({
        message: "Your balance is below the required 5000 NGN for withdrawal.",
      });
    }

    // Check if the user has made a withdrawal in the last 24 hours
    const lastWithdrawal = await Withdrawal.findOne({ user: userId }).sort({
      createdAt: -1,
    });

    if (lastWithdrawal) {
      const timeDifference = moment().diff(
        moment(lastWithdrawal.createdAt),
        "hours"
      );

      if (timeDifference < 24) {
        return res.status(400).json({
          message: "You can only request a withdrawal once every 24 hours.",
        });
      }
    }

    // Create a new withdrawal request
    const withdrawal = new Withdrawal({
      user: userId,
      amount,
      paymentMethod: "Bank", // Assuming default payment method is Bank
      accountDetails,
      status: "pending",
    });

    await withdrawal.save();

    // Log withdrawal transaction
    await Transaction.create({
      user: userId,
      type: "withdrawal",
      amount: amount,
      balanceAfter: user.earnings - amount,
      status: "pending",
      details: "User withdrawal request",
    });

    await createNotification(
      userId,
      `Withdrawal request submitted successfully. Amount: ${amount} NGN. Status: pending.`
    );

    res.status(200).json({
      message: "Withdrawal request submitted successfully.",
      withdrawal,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit withdrawal request." });
  }
});

router.get("/withdrawals", userAuth, async (req, res) => {
  const { status } = req.query;
  console.log("called", status);
  const withdrawals = await Withdrawal.find(status ? { status } : {})
    .populate("user", "_id name username")
    .sort({ createdAt: -1 });
  res.json(withdrawals);
});

router.post(
  "/process-withdrawal/:withdrawalId",
  userAuth,
  checkRole(["admin"]),
  async (req, res) => {
    try {
      const { withdrawalId } = req.params;
      const { action, processedBy } = req.body; // action = 'approve' or 'reject'

      // Ensure action is valid
      if (!["approve", "reject"].includes(action)) {
        return res
          .status(400)
          .json({ message: 'Invalid action. Use "approve" or "reject".' });
      }

      // Find the withdrawal request
      const withdrawalRequest = await Withdrawal.findById(withdrawalId)
        .populate("user", "_id name username")
        .exec();

      if (!withdrawalRequest) {
        return res
          .status(404)
          .json({ message: "Withdrawal request not found." });
      }

      const { user, amount, status, createdAt } = withdrawalRequest;

      const withdrawalUser = await User.findOne({ username: user.username });
      console.log("withdrawalUser", withdrawalUser);

      // 1. Check if the user has enough earnings (5000 Naira or more)
      if (user.balance < 5000) {
        return res.status(400).json({
          message: "User does not have sufficient earnings to withdraw.",
        });
      }

      // 3. Process the withdrawal request
      if (action === "approve") {
        withdrawalRequest.status = "approved";
        // Deduct the amount from the user's balance
        withdrawalUser.earnings -= amount;
        withdrawalUser.totalWithdrawals += amount; // Update total withdrawals

        const updatedUser = await withdrawalUser.save();

        // Create a transaction record for the withdrawal
        const transaction = new Transaction({
          user: user._id,
          type: "withdrawal",
          amount: amount,
          balanceAfter: updatedUser.earnings,
          status: "successful",
          details: `Withdrawal of ${amount} Naira processed.`,
        });
        await transaction.save();
        await createNotification(
          user._id,
          `Your withdrawal request of ${amount} Naira has been approved. Status: successful.`
        );
      } else if (action === "reject") {
        withdrawalRequest.status = "rejected";
        await createNotification(
          user._id,
          `Your withdrawal request of ${amount} Naira has been rejected. Status: failed.`
        );
      }

      // Save the updated withdrawal request
      withdrawalRequest.processedBy = processedBy;
      await withdrawalRequest.save();

      res.status(200).json({
        message: `Withdrawal request ${action}d successfully.`,
        withdrawalRequest,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

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

// Route: POST /api/users/:username/add-earning
router.post("/:username/add-earning", async (req, res) => {
  const { username } = req.params;
  const { amount, reason } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than 0." });
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Add to user's earnings
    user.earnings += amount;
    user.totalEarnings += amount;

    await user.save();

    // Create transaction
    await Transaction.create({
      user: user._id,
      type: "earning",
      amount,
      balanceAfter: user.earnings,
      details: reason || "Manual earning adjustment",
    });

    // Create notification
    await createNotification(
      user._id,
      `₦${amount.toFixed(2)} has been added to your earnings. ${reason || ""}`
    );

    res.status(200).json({
      message: `₦${amount} added to ${username}'s earnings.`,
      balanceAfter: user.earnings,
    });
  } catch (err) {
    console.error("Error adding earning:", err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
