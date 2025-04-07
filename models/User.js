const { required } = require("@hapi/joi");
const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    name: {
      type: String,
      default: "",
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      required: true,
    },
    package: { type: Schema.Types.ObjectId, ref: "Package", required: true }, // Selected package
    referredBy: { type: String, default: null }, // Stores the username of the referrer
    referrals: [{ type: String }], // List of usernames the user referred
    bv: { type: Number, default: 0 }, // BV earned from package + referrals
    earnings: { type: Number, default: 0 }, // Total earnings

    totalEarnings: { type: Number, default: 0 }, // Lifetime earnings
    totalWithdrawals: { type: Number, default: 0 }, // Total amount withdrawn
    monthlyBV: { type: Number, default: 0 }, // Monthly Personal Volume

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    phoneNumber: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = model("users", UserSchema);
