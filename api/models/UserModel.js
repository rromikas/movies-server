const mongoose = require("mongoose");

const UserModel = new mongoose.Schema({
  email: String,
  photo: {
    type: String,
    default: "https://i.ibb.co/ZmgsTPF/Person-placeholder.jpg",
  },
  password: String,
  role: { type: String, default: "Administrator" },
  first_name: String,
  last_name: String,
  display_name: String,
  status: { type: String, default: "Active" },
  last_login: Number,
  last_activity: Number,
  username: String,
  wishlist: [
    {
      movie_id: String,
    },
  ],
  notifications: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Notification" },
  ],
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  watchedlist: [
    {
      movie_id: String,
    },
  ],
  ratings: [{ movie_id: String, rate_type: String }],
});
const User = mongoose.model("User", UserModel);

module.exports = User;
