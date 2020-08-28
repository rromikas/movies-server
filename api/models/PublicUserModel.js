const mongoose = require("mongoose");

const PublicUserModel = new mongoose.Schema({
  display_name: { type: String, required: true },
  photo: {
    type: String,
    default: "https://i.ibb.co/ZmgsTPF/Person-placeholder.jpg",
  },
  role: { type: String, required: true, default: "User" },
  email: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, default: "Active" },
});
const PublicUser = mongoose.model("PublicUser", PublicUserModel);

module.exports = PublicUser;
