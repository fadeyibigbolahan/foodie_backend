const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    bv: { type: Number, required: true },
    commissionLevels: [
      {
        level: { type: Number, required: true },
        percentage: { type: Number, required: true }, // Commission percentage per level
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);
