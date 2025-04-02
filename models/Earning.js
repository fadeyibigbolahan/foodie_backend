const earningsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  level: { type: Number, required: true }, // Level 1, 2, 3, etc.
  sourceUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // Who referred this earning
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Earnings", earningsSchema);
