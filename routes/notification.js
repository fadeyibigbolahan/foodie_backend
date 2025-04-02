const express = require("express");
const Notification = require("../models/Notification");
const { userAuth } = require("../utils/Auth");
const router = express.Router();

// Fetch notifications for a user
router.get("/", userAuth, async (req, res) => {
  try {
    const userId = req.user._id; // Assuming user ID is available in req.user
    const notifications = await Notification.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

module.exports = router;
