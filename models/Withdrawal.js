const mongoose = require("mongoose");

const WithdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    paymentMethod: { type: String, required: true }, // e.g., Bank, Crypto
    accountDetails: { type: String, required: true }, // Bank or wallet details
    processedBy: { type: String }, // Admin who processed it
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", WithdrawalSchema);
