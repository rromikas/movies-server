const mongoose = require("mongoose");

const ExpiringComment = new mongoose.Schema({
  expire_at: { type: Date, default: Date.now, expires: 60 },
});

const ReviewModel = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  movie_id: { type: String, required: true },
  review: { required: true, type: String },
  rating: { required: true, type: String },
  date: { type: Number, require: true },
  reported: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  new_comments: [{ date: Number }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const Review = mongoose.model("Review", ReviewModel);

module.exports = Review;
