const { Schema, model } = require("mongoose");

const packageCodeSchema = new Schema({
  code: { type: String, required: true, unique: true },
  package: {
    type: Schema.Types.ObjectId,
    ref: "Package",
    required: true,
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  }, // Null if not used
  createdAt: { type: Date, default: Date.now },
});

module.exports = model("PackageCode", packageCodeSchema);
