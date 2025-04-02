const { Schema, model } = require("mongoose");
const cron = require("node-cron");

const NotifySchema = new Schema(
  {
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    category: {
      type: String,
      enum: ["mention", "like"],
    },
    caption: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["admin-user", "facet-user"],
      default: "admin-user",
    },
  },
  { timestamps: true }
);

module.exports = model("notify", NotifySchema);
