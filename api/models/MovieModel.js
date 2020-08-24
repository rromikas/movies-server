const mongoose = require("mongoose");

const MovieModel = new mongoose.Schema({
  title: String,
  tmdb_id: String,
  backdrop_path: String,
  poster_path: String,
  director: String,
  cast: [{ type: String }],
  runtime: Number,
  release_date: String,
  overview: String,
  adult: Boolean,
  imdb_id: String,
  genres: [],
  genre_ids: [],
  reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
});

const Movie = mongoose.model("Movie", MovieModel);

module.exports = Movie;
