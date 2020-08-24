const mongoose = require("mongoose");

const AnnouncementModel = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  start_date: { type: Number, required: true },
  end_date: { type: Number, required: true },
  type: { type: String, required: true },
  status: { type: String, required: true },
  description: { type: String, required: true },
});
const Announcement = mongoose.model("Announcement", AnnouncementModel);

module.exports = Announcement;
