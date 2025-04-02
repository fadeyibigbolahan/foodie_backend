const Notification = require("../models/Notification");

async function createNotification(userId, message) {
  await Notification.create({ user: userId, message });
}

module.exports = createNotification;
