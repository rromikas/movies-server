const mongoose = require("mongoose");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const bodyParser = require("body-parser");
const path = require("path");

require("./api/DatabaseApi")();

app.use(cors());
app.use(bodyParser.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
  );
  next();
});

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(
    () => {
      console.log(`DB connected`);
      SetSchedulers();
    },
    (err) => {
      console.log("err", err);
    }
  );

app.use(express.static(path.join(__dirname, "react-app")));

app.get("/", (request, response) => {
  response.sendFile(path.join(__dirname, "react-app", "index.html"));
});

app.get("/error", (req, res) => {
  res.json({ error: { name: "Synthetic error", message: "ok" } });
});

app.post("/movie/findOrCreate", async (req, res) => {
  let response = await FindOrCreateMovie(req.body);
  res.json(response);
});

app.post("/user/signup", async (req, res) => {
  let response = await Signup(req.body);
  res.json(response);
});

app.post("/user/login", async (req, res) => {
  let response = await Login(req.body);
  res.json(response);
});

app.post("/user/loginWithToken", async (req, res) => {
  let response = await LoginWithToken(req.body.token);
  res.json(response);
});

app.post("/user/password/sendResetLink", async (req, res) => {
  let response = await SendResetPasswordLink(req.body);
  res.json(response);
});

app.post("/user/password/reset", async (req, res) => {
  let response = await ResetPassword(req.body);
  res.json(response);
});

app.get("/ratings/get/all", async (req, res) => {
  let response = await GetAllRatings();
  res.json(response);
});

app.get("/publicUsers/get/all", async (req, res) => {
  let response = await GetAllPublicUsers();
  res.json(response);
});

app.post("/ratings/update", async (req, res) => {
  let response = await RateMovie(req.body);
  res.json(response);
});

app.post("/reviews/add", async (req, res) => {
  let response = await WriteReview(req.body);
  res.json(response);
});

app.post("/reviews/edit", async (req, res) => {
  let response = await EditReview(req.body);
  res.json(response);
});

app.post("/reviews/getOne", async (req, res) => {
  let response = await GetReview(req.body);
  res.json(response);
});

app.post("/reviews/get/movie", async (req, res) => {
  let response = await GetMovieReviews(req.body.movieId);
  res.json(response);
});

app.post("/comments/update", async (req, res) => {
  let response = await WriteComment(req.body);
  res.json(response);
});

app.post("/comments/get/review", async (req, res) => {
  let response = await GetReviewComments(req.body.reviewId);
  res.json(response);
});

app.post("/movie/moveToWatchedList", async (req, res) => {
  let response = await MoveMovieFromWishlistToWatched(req.body);
  res.json(response);
});

app.post("/movie/addToWishlist", async (req, res) => {
  let response = await AddToWishList(req.body);
  res.json(response);
});

app.post("/movie/removeFromWishlist", async (req, res) => {
  let response = await RemoveFromWishList(req.body);
  res.json(response);
});

app.post("/movie/views/add", async (req, res) => {
  let response = await AddViewToMovie(req.body);
  res.json(response);
});

app.post("/reviews/like", async (req, res) => {
  let response = await LikeReview(req.body);
  res.json(response);
});

app.post("/comments/like", async (req, res) => {
  let response = await LikeComment(req.body);
  res.json(response);
});

app.post("/reviews/report", async (req, res) => {
  let response = await ReportReview(req.body);
  res.json(response);
});

app.post("/comments/report", async (req, res) => {
  let response = await ReportComment(req.body);
  res.json(response);
});

app.post("/users/get", async (req, res) => {
  let response = await GetUser(req.body);
  res.json(response);
});

app.post("/reviews/get/user", async (req, res) => {
  let response = await GetUserReviews(req.body);
  res.json(response);
});

app.post("/comments/get/user", async (req, res) => {
  let response = await GetUserComments(req.body);
  res.json(response);
});

app.post("/users/edit", async (req, res) => {
  let response = await EditUser(req.body);
  res.json(response);
});

app.post("/reviews/get/popular", async (req, res) => {
  let response = await GetPopularReviews(req.body);
  res.json(response);
});

app.post("/reviews/get/recent", async (req, res) => {
  let response = await GetRecentReviews(req.body);
  res.json(response);
});

app.post("/movies/get/recommended", async (req, res) => {
  let response = await GetRecommendations(req.body);
  res.json(response);
});

app.post("/reviews/search", async (req, res) => {
  let response = await SearchReviews(req.body);
  res.json(response);
});

app.post("/settings/updateOrCreate", async (req, res) => {
  let response = await UpdateOrCreateSettings(req.body);
  res.json(response);
});

app.get("/settings/get", async (req, res) => {
  let response = await GetSettings();
  res.json(response);
});

app.get("/admin/users/get", async (req, res) => {
  let response = await GetUsersForAdmin();
  res.json(response);
});

app.post("/admin/users/edit", async (req, res) => {
  let response = await EditUserForAdmin(req.body);
  res.json(response);
});

app.post("/admin/users/create", async (req, res) => {
  let response = await CreateUserForAdmin(req.body);
  res.json(response);
});

app.get("/admin/reviews/get", async (req, res) => {
  let response = await GetReviewsForAdmin();
  res.json(response);
});

app.get("/admin/comments/get", async (req, res) => {
  let response = await GetCommentsForAdmin();
  res.json(response);
});

app.post("/admin/reviews/edit", async (req, res) => {
  let response = await EditReviewForAdmin(req.body);
  res.json(response);
});

app.post("/admin/comments/edit", async (req, res) => {
  let response = await EditCommentForAdmin(req.body);
  res.json(response);
});

app.post("/admin/reviews/delete", async (req, res) => {
  let response = await DeleteMultipleReviews(req.body);
  res.json(response);
});

app.post("/admin/comments/delete", async (req, res) => {
  let response = await DeleteMultipleComments(req.body);
  res.json(response);
});

app.post("/admin/users/editMultiple", async (req, res) => {
  let response = await EditMultipleUsers(req.body);
  res.json(response);
});

app.post("/admin/users/deleteMultiple", async (req, res) => {
  let response = await DeleteMultipleUsers(req.body);
  res.json(response);
});

app.get("/announcements/getActive", async (req, res) => {
  let response = await GetActiveAnnouncements();
  res.json(response);
});

app.get("/admin/announcements/get", async (req, res) => {
  let response = await GetAnnouncements();
  res.json(response);
});

app.post("/admin/announcements/create", async (req, res) => {
  let response = await CreateAnnouncement(req.body);
  res.json(response);
});

app.post("/admin/announcements/delete", async (req, res) => {
  let response = await DeleteMultipleAnnouncements(req.body);
  res.json(response);
});

app.post("/admin/announcements/edit", async (req, res) => {
  let response = await EditAnnouncement(req.body);
  res.json(response);
});

app.get("/admin/promotions/get", async (req, res) => {
  let response = await GetPromotions();
  res.json(response);
});

app.post("/admin/promotions/create", async (req, res) => {
  let response = await CreatePromotions(req.body);
  res.json(response);
});

app.post("/admin/promotions/edit", async (req, res) => {
  let response = await EditPromotion(req.body);
  res.json(response);
});

app.post("/admin/promotions/delete", async (req, res) => {
  let response = await EditMultiplePromotions(req.body);
  res.json(response);
});

app.post("/reviews/getPromoted/movie", async (req, res) => {
  let response = await GetMoviePromotedReviews(req.body);
  res.json(response);
});

app.get("/reviews/getPromoted", async (req, res) => {
  let response = await GetPromotedReviews();
  res.json(response);
});

app.get("/admin/notifications/get", async (req, res) => {
  let response = await GetNotifications();
  res.json(response);
});

app.post("/admin/notifications/create", async (req, res) => {
  let response = await CreateNotification(req.body);
  res.json(response);
});

app.post("/admin/notifications/edit", async (req, res) => {
  let response = await EditNotification(req.body);
  res.json(response);
});

app.post("/admin/notifications/delete", async (req, res) => {
  let response = await EditMultipleNotifications(req.body);
  res.json(response);
});

app.post("/user/notifications/get", async (req, res) => {
  let response = await GetUserNotifications(req.body);
  res.json(response);
});

app.post("/user/notifications/delete", async (req, res) => {
  let response = await DeleteUserNotification(req.body);
  res.json(response);
});

app.post("/changeBackgroundMovie", async (req, res) => {
  let response = await ChangeBackgroundMovie(req.body);
  res.json(response);
});

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "react-app", "index.html"));
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
