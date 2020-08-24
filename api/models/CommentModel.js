const mongoose = require("mongoose");

const CommentModel = new mongoose.Schema({
  comment: { required: true, type: String },
  parentComments: [],
  comments: [],
  review_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review",
    required: true,
  },
  notificationReceivers: [],
  reported: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  review: { type: String, required: true },
  movie_id: { type: String, required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  date: { type: Number, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});
const Comment = mongoose.model("Comment", CommentModel);

module.exports = Comment;
