const mongoose = require("mongoose");

const PromotionModel = new mongoose.Schema({
  start_date: { type: Number, required: true },
  end_date: { type: Number, required: true },
  content_type: { type: String, required: true },
  description: { type: String, required: true },
  movie_id: { type: String, required: true },
  status: { type: String, required: true }, // Published | Drafted | Deleted
  content_id: { type: String, required: true },
  content: {},
  content_author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});
const Promotion = mongoose.model("Promotion", PromotionModel);

module.exports = Promotion;
