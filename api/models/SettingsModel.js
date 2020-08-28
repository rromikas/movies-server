const mongoose = require("mongoose");

const SettingsModel = new mongoose.Schema({
  movies_api_key: { type: String },
  captcha_api_key: { type: String },
  no_popular_reviews: { type: Number, default: 5 },
  no_popular_movies: { type: Number, default: 5 },
  no_allowed_reviews_per_day: { type: Number, default: 5 },
  no_review_words: { type: Number, default: 400 },
  no_comment_characters: { type: Number, default: 400 },
  no_display_name_characters: { type: Number, default: 40 },
  bg_image_refresh_time_days: { type: Number, default: 0 },
  bg_image_refresh_time_hours: { type: Number, default: 0 },
  bg_image_refresh_time_minutes: { type: Number, default: 0 },
  current_bg_movie: {
    date_set: { type: Number, required: true },
    id: { type: String, required: true },
    poster_path: { type: String, required: true },
    backdrop_path: { type: String, required: true },
    release_date: { type: String, required: true },
    overview: { type: String, required: true },
    title: { type: String, required: true },
    genres: [],
    runtime: { type: Number, required: true },
  },
  past_bg_movies: [],
  FacebookLink: String,
  TwitterLink: String,
  InstagramLink: String,
  LinkedinLink: String,
});

const Settings = mongoose.model("Settings", SettingsModel);

module.exports = Settings;
