const mongoose = require("mongoose");

const RatingModel = new mongoose.Schema({
  tmdb_id: { type: String, required: true },
  imdb_id: { type: String, required: true },
  movie_title: { type: String, required: true },
  movie_id: { type: String, required: true },
  movie_poster: { type: String, required: true },
  movie_genres: [],
  movie_release_date: { type: String, required: true },
  new_excellent_rate: [{ date: Number }],
  excellent_rate: [],
  good_rate: [],
  ok_rate: [],
  bad_rate: [],
  views: { type: Number, default: 0 },
  wishlisted: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
});
const Rating = mongoose.model("Rating", RatingModel);

module.exports = Rating;
