const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: [
      "earning",
      "withdrawal",
      "commission",
      "bonus",
      "extra-commission",
      "package-upgrade",
      "upgrade-reward",
    ],
    required: true,
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true }, // User's balance after transaction
  status: {
    type: String,
    enum: ["pending", "successful", "failed"],
    default: "successful",
  },
  details: String, // Description of the transaction
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", TransactionSchema);
