const mongoose = require("mongoose");

const NotificationModel = new mongoose.Schema({
  type: { type: String, required: true },
  subject: { type: String, required: true },
  receivers: [],
  start_date: { type: Number, required: true },
  end_date: { type: Number, required: true },
  description: { type: String, required: true },
  status: { type: String, required: true },
  executed: { type: String, default: false },
});
const Notification = mongoose.model("Notification", NotificationModel);

module.exports = Notification;
