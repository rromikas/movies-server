const mongoose = require("mongoose");
const User = require("./models/UserModel");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const PublicUser = require("./models/PublicUserModel");
const Rating = require("./models/RatingModel");
const Comment = require("./models/CommentModel");
const Review = require("./models/ReviewModel");
const {
  SendEmail,
  FormatEmail,
  FormatAdminNotification,
} = require("./EmailsApi");
const { MoviesGenresMap } = require("./Data");
const Settings = require("./models/SettingsModel");
const Announcement = require("./models/AnnouncementModel");
const Promotion = require("./models/PromotionModel");
const Notification = require("./models/NotificationModel");
const fetch = require("node-fetch");
const bcrypt = require("bcryptjs");
var schedule = require("node-schedule");

const origin = "https://api.themoviedb.org/3";
const FormatRequestUrl = (path, params = [], apiKey) => {
  return `${origin}${path}?api_key=${apiKey}&${["language=en-US"]
    .concat(params)
    .join("&")}`;
};

const getMovieDetails = (apiKey, movieId) => {
  return fetch(FormatRequestUrl(`/movie/${movieId}`, [], apiKey)).then((res) =>
    res.json()
  );
};

const getSerieDetails = (apiKey, serieId) => {
  return fetch(FormatRequestUrl(`/tv/${serieId}`, [], apiKey)).then((res) =>
    res.json()
  );
};

const generateUserToken = (user) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      { data: user },
      process.env.SECRET,
      { expiresIn: "7d" },
      async (err, token) => {
        if (err) {
          resolve({ error: "jwt error email form login" });
        } else {
          resolve({ token });
        }
      }
    );
  });
};

const RemoveObsoleteCommentsFromReviews = async (
  expirationTime = 2592000000
) => {
  try {
    Review.updateMany(
      {},
      {
        $pull: {
          new_comments: { date: { $lte: Date.now() - expirationTime } },
        },
      }
    ).exec();
  } catch (error) {
    console.log("error: ", error);
  }
};

const UpdateNewExcellentRatings = async (expirationTime = 2592000000) => {
  try {
    Rating.updateMany(
      {},
      {
        $pull: {
          new_excellent_rate: { date: { $lte: Date.now() - expirationTime } },
        },
      }
    ).exec();
  } catch (error) {
    console.log("error: ", error);
  }
};

const generateUserFromToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
      if (!err) {
        resolve(decoded.data);
      } else {
        resolve({ error: err });
      }
    });
  });
};

module.exports = function () {
  this.LoginWithToken = (token) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(token);

        if (validUser.error) {
          resolve({ error: validUser.error });
        } else {
          let userData = await User.findOne({
            email: validUser.email,
            status: { $ne: "Deleted" },
          });
          if (userData) {
            userData.last_login = Date.now();
            userData.save();
            let ratings = {};
            userData.ratings.forEach((x) => {
              ratings[x.movie_id] = x;
            });
            resolve({
              first_name: userData.first_name,
              last_name: userData.last_name,
              email: userData.email,
              photo: userData.photo,
              display_name: userData.display_name,
              token: token,
              ratings: ratings,
              wishlist: userData.wishlist,
              watchedlist: userData.watchedlist,
              reviews: userData.reviews,
              comments: userData.comments,
              role: userData.role,
              _id: userData._id,
              notifications: userData.notifications
                ? userData.notifications
                : [],
            });
          } else {
            resolve({ error: "User no longer exists" });
          }
        }
      } catch (er) {
        console.log("er", er);
        resolve({ error: er });
      }
    });
  };

  this.Login = (credentials) => {
    return new Promise(async (resolve, reject) => {
      try {
        let user = await User.findOne({
          email: credentials.email,
          status: { $ne: "Deleted" },
        });
        let passwordsMatch = await this.ComparePasswords(
          user.password,
          credentials.password
        );
        console.log("PAsswords march", passwordsMatch);
        if (user && passwordsMatch) {
          user.last_login = Date.now();
          user.save();
          let res = await generateUserToken(user);
          if (res.error) {
            resolve({ error: res.error });
          } else {
            let ratings = {};
            user.ratings.forEach((x) => {
              ratings[x.movie_id] = x;
            });
            resolve({
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              comments: user.comments,
              photo: user.photo,
              display_name: user.display_name,
              token: res.token,
              ratings: ratings,
              wishlist: user.wishlist,
              watchedlist: user.watchedlist,
              reviews: user.reviews,
              role: user.role,
              _id: user._id,
              notifications: user.notifications ? user.notifications : [],
            });
          }
        } else {
          resolve({ error: "Wrong credentials" });
        }
      } catch (er) {
        console.log("er", er);
        resolve({ error: er });
      }
    });
  };

  this.ComparePasswords = (hash, plain) => {
    return new Promise((resolve, reject) => {
      bcrypt.compare(plain, hash, (error, isMatch) => {
        if (error) {
          resolve({ error });
        } else {
          resolve(isMatch);
        }
      });
    });
  };

  this.CreatePassword = (password) => {
    return new Promise((resolve, reject) => {
      bcrypt.genSalt(10).then((salt) => {
        bcrypt.hash(password, salt, (error, hash) => {
          if (error) {
            resolve({ error });
          } else {
            resolve(hash);
          }
        });
      });
    });
  };

  this.Signup = (data) => {
    return new Promise(async (resolve, reject) => {
      try {
        data.display_name = data.email.split("@")[0];
        let exists = await User.findOne({ email: data.email });
        if (!exists) {
          let hashedPassword = await this.CreatePassword(data.password);
          if (hashedPassword.error) {
            resolve({ error: hashedPassword.error });
          } else {
            data.password = hashedPassword;
            let user = new User(data);
            data.user_id = user._id;
            let publicUser = new PublicUser(data);
            publicUser.save((er) => {
              if (er) {
                console.log("error saving public user: ", er);
              }
            });

            user.save((er) => {
              if (!er) {
                resolve({ success: true, publicUser });
              } else {
                console.log("error saving user: ", er);
                resolve({ error: er });
              }
            });
          }
        } else {
          resolve({ error: "User exists" });
        }
      } catch (er) {
        console.log("error creating account: ", er);
        resolve({ error: er });
      }
    });
  };

  this.GetAllRatings = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let ratings = await Rating.find({});
        resolve(ratings);
      } catch (er) {
        resolve({ error: er });
      }
    });
  };

  this.GetAllPublicUsers = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let publicUsers = await PublicUser.find({});
        resolve(publicUsers);
      } catch (er) {
        resolve({ error: er });
      }
    });
  };

  this.MoveMovieFromWishlistToWatched = ({ user, movieId, apiKey }) => {
    return new Promise(async (resolve, reject) => {
      try {
        movieId = movieId.toString();
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let updatedUser = await User.findOne({ email: validUser.email });
          let existingIndex = updatedUser.wishlist.findIndex(
            (x) => x.movie_id === movieId.toString()
          );
          if (existingIndex !== -1) {
            updatedUser.wishlist.splice(existingIndex, 1);
          }
          let ratingExists = await Rating.findOne({ tmdb_id: movieId });
          let newRating;
          if (!ratingExists) {
            let movieDetails;
            if (movieId.substring(0, 6) === "serie-") {
              let serieId = movieId.substring(6);
              let serieDetails = await getSerieDetails(apiKey, serieId);
              movieDetails = Object.assign({}, serieDetails, {
                title: serieDetails.name,
                release_date: serieDetails.first_air_date,
                id: movieId,
              });
            } else {
              movieDetails = await getMovieDetails(apiKey, movieId);
            }
            movieDetails.imdb_id = movieDetails.imdb_id
              ? movieDetails.imdb_id
              : "uknown";
            let rateObj = {};
            rateObj["tmdb_id"] = movieDetails.id;
            rateObj["imdb_id"] = movieDetails.imdb_id;
            rateObj.movie_title = movieDetails.title;
            rateObj.movie_genres = movieDetails.genres
              ? movieDetails.genres.map((x) => x.name)
              : movieDetails.genre_ids
              ? movieDetails.genre_ids.map((x) => MoviesGenresMap[x])
              : "unknown";
            rateObj.movie_poster = movieDetails.poster_path;
            rateObj.movie_release_date = movieDetails.release_date;
            rateObj.movie_id = movieDetails.id;
            newRating = new Rating(rateObj);
            newRating.save((er) => {
              if (er) {
                console.log("error saving new rating add watched list", er);
              }
            });
          } else {
            if (existingIndex !== -1) {
              ratingExists["wishlisted"] -= 1;
            }

            ratingExists.save((er) => {
              if (er) {
                console.log("error saving new rating add wish list", er);
              }
            });
          }

          updatedUser.watchedlist.push({ movie_id: movieId });
          updatedUser.save((error) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({
                success: true,
                updatedUser,
                rating: ratingExists ? ratingExists : newRating,
              });
            }
          });
        }
      } catch (error) {
        console.log("error", error);
        resolve({ error });
      }
    });
  };

  this.RemoveFromWishList = ({ user, movieId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let updatedUser = await User.update(
            { email: validUser.email },
            { $pull: { wishlist: { movie_id: movieId } } }
          );

          resolve({ updatedUser: { wishlist: updatedUser.wishlist } });
        }
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.AddToWishList = ({ user, movieId, apiKey }) => {
    return new Promise(async (resolve, reject) => {
      try {
        movieId = movieId.toString();
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let updatedUser = await User.findOne({ email: validUser.email });

          let existingIndex = updatedUser.wishlist.findIndex(
            (x) => x.movie_id === movieId.toString()
          );

          let ratingExists = await Rating.findOne({ tmdb_id: movieId });
          if (!ratingExists) {
            let movieDetails;
            if (movieId.substring(0, 6) === "serie-") {
              let serieId = movieId.substring(6);
              let serieDetails = await getSerieDetails(apiKey, serieId);
              movieDetails = Object.assign({}, serieDetails, {
                title: serieDetails.name,
                release_date: serieDetails.first_air_date,
                id: movieId,
              });
            } else {
              movieDetails = await getMovieDetails(apiKey, movieId);
            }
            movieDetails.imdb_id = movieDetails.imdb_id
              ? movieDetails.imdb_id
              : "uknown";
            let rateObj = {};
            rateObj["tmdb_id"] = movieDetails.id;
            rateObj["imdb_id"] = movieDetails.imdb_id;
            rateObj["wishlisted"] = 1;
            rateObj.movie_title = movieDetails.title;
            rateObj.movie_genres = movieDetails.genres
              ? movieDetails.genres.map((x) => x.name)
              : movieDetails.genre_ids
              ? movieDetails.genre_ids.map((x) => MoviesGenresMap[x])
              : "unknown";
            rateObj.movie_poster = movieDetails.poster_path;
            rateObj.movie_release_date = movieDetails.release_date;
            rateObj.movie_id = movieDetails.id;
            let newRating = new Rating(rateObj);
            newRating.save((er) => {
              if (er) {
                console.log("error saving new rating add wish list", er);
              }
            });
          } else {
            if (existingIndex !== -1) {
              ratingExists["wishlisted"] -= 1;
            } else {
              ratingExists["wishlisted"] += 1;
            }

            ratingExists.save((er) => {
              if (er) {
                console.log("error saving new rating add wish list", er);
              }
            });
          }

          let actionValid = false;

          if (existingIndex !== -1) {
            actionValid = true;
            updatedUser.wishlist.splice(existingIndex, 1);
          } else {
            let existsInWatched = updatedUser.watchedlist.findIndex(
              (x) => x.movie_id === movieId.toString()
            );

            if (existsInWatched === -1) {
              actionValid = true;
              updatedUser.wishlist.push({
                movie_id: movieId,
              });
            }
          }

          updatedUser.last_activity = Date.now();

          updatedUser.save((error) => {
            if (error) {
              resolve({ error });
            } else {
              if (actionValid) {
                resolve({ updatedUser: { wishlist: updatedUser.wishlist } });
              } else {
                resolve({ error: "This movie is in your watched list" });
              }
            }
          });
        }
      } catch (error) {
        console.log("Error adding to w", error);
        resolve({ error });
      }
    });
  };

  this.EditReview = ({ review, prevReview, userId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (prevReview.rating !== review.rating) {
          let rating = await Rating.findOne({ movie_id: prevReview.movie_id });
          if (rating) {
            rating[prevReview.rating] -= 1;
            rating[review.rating] += 1;
            if (review.rating === "excellent_rate") {
              rating["new_excellent_rate"].push({ date: Date.now() });
              //new excellent rates determine recommended movies
              UpdateNewExcellentRatings();
            }
            rating.save((er) => {
              if (er) {
                console.log("errror editing review in updating rating");
              }
            });
          }
        }
        let user = await User.findOne({ _id: userId });
        let ratingIndex = user.ratings.findIndex(
          (x) => x.movie_id === prevReview.movie_id.toString()
        );
        if (ratingIndex !== -1) {
          user.ratings[ratingIndex].rate_type = review.rating;
        }
        user.save((er) => {
          if (er) {
            console.log("error editing review in saving user", er);
          }
        });
        Review.updateOne({ _id: prevReview._id }, review).exec((error, res) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };

  this.WriteReview = ({ review, movieId, user, apiKey }) => {
    return new Promise(async (resolve, reject) => {
      try {
        movieId = movieId.toString();
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let writer = await User.findOne({ email: validUser.email }).exec();

          let existingReview = await Review.findOne({
            movie_id: movieId,
            deleted: false,
            author: writer._id,
          });

          if (!existingReview) {
            review.movie_id = movieId;
            review.author = writer._id;
            review.date = Date.now();

            let newReview = new Review(review);
            newReview.save((error) => {
              if (error) {
                resolve({ error });
              }
            });

            let delIndex = writer.ratings.findIndex(
              (x) => x.movie_id === movieId.toString()
            );

            let rateTypeToReduce = "";

            let newUserRating = {
              movie_id: movieId,
              rate_type: review.rating,
            };

            if (delIndex !== -1) {
              rateTypeToReduce = writer.ratings[delIndex].rate_type;
              writer.ratings[delIndex].rate_type = review.rating;
            } else {
              writer.ratings.push(newUserRating);
            }

            writer.reviews.push(newReview._id);

            let reviewIndexInWishlist = writer.wishlist.findIndex(
              (x) => x.movie_id === movieId.toString()
            );

            if (reviewIndexInWishlist !== -1) {
              writer.wishlist.splice(reviewIndexInWishlist, 1);
            }

            let reviewIndexInWatchlist = writer.watchedlist.findIndex(
              (x) => x.movie_id === movieId.toString()
            );
            if (reviewIndexInWatchlist === -1) {
              writer.watchedlist.push({
                movie_id: movieId,
              });
            }

            writer.last_activity = Date.now();

            writer.save((error) => {
              if (error) {
                resolve({ error });
              }
            });

            //new excellent rates determine recommended movies
            UpdateNewExcellentRatings();

            let ratingExists = await Rating.findOne({ tmdb_id: movieId });
            if (!ratingExists) {
              let movieDetails;
              if (movieId.substring(0, 6) === "serie-") {
                let serieId = movieId.substring(6);
                let serieDetails = await getSerieDetails(apiKey, serieId);
                movieDetails = Object.assign({}, serieDetails, {
                  title: serieDetails.name,
                  release_date: serieDetails.first_air_date,
                  id: movieId,
                });
              } else {
                movieDetails = await getMovieDetails(apiKey, movieId);
              }
              movieDetails.imdb_id = movieDetails.imdb_id
                ? movieDetails.imdb_id
                : "uknown";
              let rateObj = {};
              rateObj[review.rating] = 1;
              rateObj["tmdb_id"] = movieDetails.id;
              rateObj["imdb_id"] = movieDetails.imdb_id;
              rateObj["reviews"] = 1;
              rateObj.movie_title = movieDetails.title;
              rateObj.movie_genres = movieDetails.genres
                ? movieDetails.genres.map((x) => x.name)
                : movieDetails.genre_ids
                ? movieDetails.genre_ids.map((x) => MoviesGenresMap[x])
                : "unknown";
              rateObj.movie_poster = movieDetails.poster_path;
              rateObj.movie_release_date = movieDetails.release_date;
              rateObj.movie_id = movieDetails.tmdb_id;
              if (review.rating === "excellent_rate") {
                rateObj["new_excellent_rate"] = [{ date: Date.now() }];
              }
              let newRating = new Rating(rateObj);
              newRating.save((er) => {
                if (er) {
                  resolve({ error: er });
                } else {
                  resolve({
                    success: true,
                    reviewId: newReview._id,
                    rating: newRating,
                  });
                }
              });
            } else {
              if (rateTypeToReduce) {
                ratingExists[rateTypeToReduce] -= 1;
              }
              if (review.rating === "excellent_rate") {
                ratingExists.new_excellent_rate.push({ date: Date.now() });
              }

              ratingExists[review.rating] += 1;
              ratingExists["reviews"] += 1;
              ratingExists.save((er) => {
                if (er) {
                  resolve({ error: er });
                } else {
                  resolve({
                    success: true,
                    reviewId: newReview._id,
                    rating: ratingExists,
                  });
                }
              });
            }
          } else {
            resolve({ error: "User can write only one review for a movie" });
          }
        } else {
          resolve({ error: validUser.error });
        }
      } catch (er) {
        console.log("error", er);
        resolve({ error: er });
      }
    });
  };

  this.WriteComment = ({ user, comment }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          comment.notificationReceivers.forEach((x) => {
            let html = FormatEmail(
              `You received reply to your ${
                x.user_id === comment.review_author ? "review" : "comment"
              } from ${comment.author_name}`,
              `https://mowies.netlify.com/movie/${comment.movie_id}`,
              user.photo,
              comment.comment,
              "https://mowies.netlify.com"
            );
            let title = `${comment.author_name} replied to your ${
              x.user_id === comment.review_author ? "review" : "comment"
            }`;

            title = title.charAt(0).toUpperCase() + title.slice(1);
            SendEmail(x.email, html, title);
          });

          let commenter = await User.findOne({ email: validUser.email });
          comment.author = commenter._id;
          comment.date = Date.now();
          let newComment = new Comment(comment);

          Comment.updateOne(
            { _id: comment.comment_id },
            { $push: { comments: newComment._id } }
          ).exec();

          Review.update(
            { _id: comment.review_id },
            {
              $push: {
                comments: newComment._id,
                new_comments: { date: comment.date },
              },
            }
          ).exec();
          commenter.comments.push(newComment._id);
          commenter.last_activity = Date.now();

          commenter.save();

          RemoveObsoleteCommentsFromReviews();

          newComment.save((error) => {
            if (error) {
              console.log("Error", error);
              resolve({ error });
            } else {
              resolve({ success: true, newComment });
            }
          });
        } else {
          resolve({ error: validUser.error });
        }
      } catch (error) {
        console.log("error", error);
        resolve({ error });
      }
    });
  };

  this.GetMovieReviews = (movieId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Review.find({
          movie_id: movieId,
          deleted: false,
        });
        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetPromotedReviews = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Promotion.find({
          status: "Published",
          content_type: "Review",
          start_date: { $lte: Date.now() },
          end_date: { $gte: Date.now() },
        });
        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetMoviePromotedReviews = ({ movieId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Promotion.find({
          status: "Published",
          content_type: "Review",
          movie_id: movieId,
          start_date: { $lte: Date.now() },
          end_date: { $gte: Date.now() },
        });
        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetReviewComments = (reviewId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let comments = await Comment.find({
          review_id: reviewId.toString(),
          deleted: false,
        });
        resolve(comments);
      } catch (error) {
        console.log("coments error", error);
        resolve({ error });
      }
    });
  };

  this.AddViewToMovie = ({ movieId, apiKey }) => {
    return new Promise(async (resolve, reject) => {
      try {
        movieId = movieId.toString();
        let ratingExists = await Rating.findOne({ tmdb_id: movieId });
        if (!ratingExists) {
          let movieDetails;
          if (movieId.substring(0, 6) === "serie-") {
            let serieId = movieId.substring(6);
            let serieDetails = await getSerieDetails(apiKey, serieId);
            movieDetails = Object.assign({}, serieDetails, {
              title: serieDetails.name,
              release_date: serieDetails.first_air_date,
              id: movieId,
            });
          } else {
            movieDetails = await getMovieDetails(apiKey, movieId);
          }
          movieDetails.imdb_id = movieDetails.imdb_id
            ? movieDetails.imdb_id
            : "uknown";
          let rateObj = {};
          rateObj["tmdb_id"] = movieDetails.id;
          rateObj["imdb_id"] = movieDetails.imdb_id;
          rateObj.movie_title = movieDetails.title;
          rateObj.movie_genres = movieDetails.genres
            ? movieDetails.genres.map((x) => x.name)
            : movieDetails.genre_ids
            ? movieDetails.genre_ids.map((x) => MoviesGenresMap[x])
            : "unknown";
          rateObj.movie_poster = movieDetails.poster_path;
          rateObj.movie_release_date = movieDetails.release_date;
          rateObj.movie_id = movieDetails.id;
          rateObj["views"] = 1;
          let newRating = new Rating(rateObj);
          newRating.save((er) => {
            if (er) {
              console.log("ERROR ADDING NEW RATING", er);
              resolve({ error: er });
            } else {
              resolve({ success: true });
            }
          });
        } else {
          ratingExists["views"] += 1;
          ratingExists.save((er) => {
            if (er) {
              resolve({ error: er });
            } else {
              resolve({ success: true });
            }
          });
        }
      } catch (error) {
        console.log("Error adding view to movie", error);
        resolve({ error });
      }
    });
  };

  this.LikeReview = ({ user, reviewId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let review = await Review.findOne({ _id: reviewId });
          let existingIndex = review.likes.findIndex((x) =>
            x.equals(validUser._id)
          );

          if (existingIndex === -1) {
            review.likes.push(validUser._id);
            review.save((error) => {
              if (error) {
                resolve({ error });
              } else {
                resolve({ success: true });
              }
            });
          } else {
            resolve({ error: "You already like this review" });
          }
        } else {
          resolve({ error: "user is not valid" });
        }
      } catch (error) {
        console.log("errr", error);
        resolve({ error });
      }
    });
  };

  this.LikeComment = ({ user, commentId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let comment = await Comment.findOne({ _id: commentId });
          let existingIndex = comment.likes.findIndex((x) =>
            x.equals(validUser._id)
          );
          if (existingIndex === -1) {
            comment.likes.push(validUser._id);
            comment.save((error) => {
              if (error) {
                resolve({ error });
              } else {
                resolve({ success: true });
              }
            });
          } else {
            resolve({ error: "You already like this comment" });
          }
        } else {
          resolve({ error: "user is not valid" });
        }
      } catch (error) {
        console.log("errr", error);
        resolve({ error });
      }
    });
  };

  this.ReportReview = ({ user, reviewId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let review = await Review.findOne({ _id: reviewId });
          review.reported = true;
          review.save((error) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          });
        } else {
          resolve({ error: "user is not valid" });
        }
      } catch (error) {
        console.log("errr", error);
        resolve({ error });
      }
    });
  };

  this.ReportComment = ({ user, commentId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(user.token);
        if (!validUser.error) {
          let comment = await Comment.findOne({ _id: commentId });
          comment.reported = true;
          comment.save((error) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          });
        } else {
          resolve({ error: "user is not valid" });
        }
      } catch (error) {
        console.log("errr", error);
        resolve({ error });
      }
    });
  };

  this.GetUser = ({ userId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          let user = await User.findById(userId);
          resolve(user);
        } else {
          resolve({ error: "user id is not valid" });
        }
      } catch (error) {
        console.log("error", error);
        resolve({ error });
      }
    });
  };

  this.GetUserReviews = ({ reviewIds }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Review.find({
          deleted: false,
          _id: {
            $in: reviewIds,
          },
        });
        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetUserComments = ({ commentIds }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let comments = await Comment.find({
          deleted: false,
          _id: {
            $in: commentIds,
          },
        });
        resolve(comments);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditUser = ({ update }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let validUser = await generateUserFromToken(update.token);
        if (!validUser.error) {
          update.last_activity = Date.now();
          let updatedUser = await User.findOneAndUpdate(
            { email: validUser.email },
            update,
            { new: true }
          );
          let updatedPublicUser = await PublicUser.findOneAndUpdate(
            { email: validUser.email },
            update,
            { new: true }
          );

          let newToken = await generateUserToken(updatedUser);
          resolve({
            success: true,
            updatedUser,
            updatedPublicUser,
            newToken: newToken.token,
          });
        } else {
          resolve({ error: "user not valid" });
        }
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };
  this.GetPopularReviews = ({ limit }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Review.find({ deleted: false });
        reviews.sort((a, b) =>
          a.new_comments.length < b.new_comments.length
            ? 1
            : a.new_comments.length > b.new_comments.length
            ? -1
            : 0
        );
        resolve(reviews.slice(0, limit));
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetRecentReviews = ({ limit }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Review.find({ deleted: false })
          .sort({ date: -1 })
          .limit(limit);
        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetRecommendations = ({ limit }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let movies = await Rating.find({});
        movies.sort((a, b) =>
          a.new_excellent_rate.length < b.new_excellent_rate.length
            ? 1
            : a.new_excellent_rate.length > b.new_excellent_rate.length
            ? -1
            : 0
        );
        resolve(movies.slice(0, limit));
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.SearchReviews = ({ query }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Review.find({
          review: { $regex: query, $options: "i" },
        });

        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetSettings = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let settings = await Settings.find({});
        resolve(settings);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.UpdateOrCreateSettings = (settings) => {
    return new Promise(async (resolve, reject) => {
      try {
        let existingSettings = await Settings.find({});
        if (existingSettings.length) {
          Settings.updateOne(
            { _id: existingSettings[0]._id },
            settings,
            (error, doc) => {
              if (error) {
                resolve({ error });
              } else {
                resolve({ success: true });
              }
            }
          );
        } else {
          let newSettings = new Settings(settings);
          newSettings.save((error) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          });
        }
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };

  this.GetUsersForAdmin = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let users = await User.find(
          { status: { $ne: "Deleted" } },
          {
            first_name: 1,
            last_name: 1,
            display_name: 1,
            status: 1,
            last_login: 1,
            last_activity: 1,
            role: 1,
            email: 1,
            password: 1,
            photo: 1,
          }
        );
        resolve(users);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditUserForAdmin = (update) => {
    return new Promise(async (resolve, reject) => {
      try {
        delete update["_id"];
        await User.findOneAndUpdate(
          { email: update.email },
          update,
          { new: true },
          (error, doc) => {
            if (error) {
              resolve({ error });
            }
          }
        ).exec();

        await PublicUser.findOneAndUpdate(
          { email: update.email },
          update,
          { new: true },
          (error, doc) => {
            if (error) {
              resolve({ error });
            }
          }
        ).exec();

        resolve({
          success: true,
        });
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };

  this.CreateUserForAdmin = (user) => {
    return new Promise(async (resolve, reject) => {
      try {
        user.display_name = user.display_name
          ? user.display_name
          : user.email.split("@")[0];
        existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          newUser = new User(user);
          let res1 = await new Promise((resolve, reject) => {
            newUser.save((error) => {
              if (error) {
                resolve({ error });
              } else {
                resolve({ success: true });
              }
            });
          });

          user.user_id = newUser._id;

          newPublicUser = new PublicUser(user);
          let res2 = await new Promise((resolve, reject) => {
            newPublicUser.save((error) => {
              if (error) {
                resolve({ error });
              } else {
                resolve({ success: true });
              }
            });
          });
          if (res1.error || res2.error) {
            resolve({ error: res1.error ? res1.error : res2.error });
          } else {
            resolve({
              success: true,
              pid: newPublicUser._id,
              id: newUser._id,
            });
          }
        } else {
          resolve({ error: "This email is taken" });
        }
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };

  this.GetReview = ({ reviewId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let review = await Review.findOne({ _id: reviewId });
        resolve(review);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetReviewsForAdmin = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviews = await Review.find({});
        resolve(reviews);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetCommentsForAdmin = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let comments = await Comment.find({});
        resolve(comments);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditReviewForAdmin = ({ review, user }) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (user) {
          delete user["_id"];
          await User.findOneAndUpdate(
            { email: user.email },
            user,
            { new: true },
            (error, doc) => {
              if (error) {
                resolve({ error });
              }
            }
          ).exec();

          await PublicUser.findOneAndUpdate(
            { email: user.email },
            user,
            { new: true },
            (error, doc) => {
              if (error) {
                resolve({ error });
              }
            }
          ).exec();
        }

        let reviewId = review._id;
        delete review["_id"];

        Review.updateOne({ _id: reviewId }, review, (error, doc) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });

        resolve({
          success: true,
        });
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };

  this.EditCommentForAdmin = ({ comment, user }) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (user) {
          delete user["_id"];
          await User.findOneAndUpdate(
            { email: user.email },
            user,
            { new: true },
            (error, doc) => {
              if (error) {
                resolve({ error });
              }
            }
          ).exec();

          await PublicUser.findOneAndUpdate(
            { email: user.email },
            user,
            { new: true },
            (error, doc) => {
              if (error) {
                resolve({ error });
              }
            }
          ).exec();
        }

        let commentId = comment._id;
        delete comment["_id"];

        Comment.updateOne({ _id: commentId }, comment, (error, doc) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });

        resolve({
          success: true,
        });
      } catch (error) {
        console.log("Error", error);
        resolve({ error });
      }
    });
  };

  this.DeleteMultipleReviews = (ids) => {
    return new Promise(async (resolve, reject) => {
      try {
        for (let i = 0; i < ids.length; i++) {
          User.updateOne(
            { reviews: ids[i] },
            { $pull: { reviews: ids[i] } }
          ).exec();
        }
        Review.updateMany(
          { _id: { $in: ids } },
          { deleted: true },
          (error, doc) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          }
        );
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.DeleteMultipleComments = (ids) => {
    return new Promise(async (resolve, reject) => {
      try {
        for (let i = 0; i < ids.length; i++) {
          Review.updateOne(
            { comments: ids[i] },
            { $pull: { comments: ids[i] } }
          ).exec();
          User.updateOne(
            { comments: ids[i] },
            { $pull: { comments: ids[i] } }
          ).exec();
        }
        Comment.updateMany(
          { _id: { $in: ids } },
          { deleted: true },
          (error, doc) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          }
        );
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.DeleteMultipleUsers = ({ ids, pids }) => {
    return new Promise(async (resolve, reject) => {
      try {
        PublicUser.updateMany(
          { _id: { $in: pids } },
          { status: "Deleted" }
        ).exec();
        User.updateMany(
          { _id: { $in: ids } },
          { status: "Deleted" },
          (error) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          }
        );
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditMultipleUsers = ({ ids, pids, update }) => {
    return new Promise(async (resolve, reject) => {
      try {
        PublicUser.updateMany({ _id: { $in: pids } }, update).exec();
        User.updateMany({ _id: { $in: ids } }, update, (error, doc) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetAnnouncements = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let announcements = await Announcement.find({});
        resolve(announcements);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.CreateAnnouncement = (announcement) => {
    return new Promise(async (resolve, reject) => {
      try {
        let newAnouncement = new Announcement(announcement);
        newAnouncement.save((error) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.DeleteMultipleAnnouncements = (ids) => {
    return new Promise(async (resolve, reject) => {
      try {
        Announcement.updateMany(
          { _id: { $in: ids } },
          { status: "Deleted" },
          (error, doc) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          }
        );
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditAnnouncement = (announcement) => {
    return new Promise(async (resolve, reject) => {
      try {
        let aid = announcement._id;
        delete announcement["_id"];
        Announcement.updateOne(
          { _id: aid },
          announcement,
          { new: true },
          (error, doc) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true, newAnouncement: doc });
            }
          }
        );
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetActiveAnnouncements = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let announcements = await Announcement.find({
          start_date: { $lte: Date.now() },
          end_date: { $gte: Date.now() },
          status: "Published",
        });
        resolve(announcements);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetPromotions = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let promotions = await Promotion.find({});
        resolve(promotions);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.CreatePromotions = (promotions) => {
    return new Promise(async (resolve, reject) => {
      try {
        let reviewsIds = [],
          commentsIds = [];
        promotions.forEach((x) => {
          if (x.content_type === "Review") {
            reviewsIds.push(x.content_id);
          } else {
            commentsIds.push(x.content_id);
          }
        });
        Review.updateMany(
          { _id: { $in: reviewsIds } },
          { status: "Deleted" },
          (error, doc) => {}
        );
        Promotion.insertMany(promotions)
          .then(function (docs) {
            resolve({ success: true });
          })
          .catch(function (error) {
            console.log("errro", error);
            resolve({ error });
          });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditPromotion = (promotion) => {
    return new Promise(async (resolve, reject) => {
      try {
        let pid = promotion._id;
        delete promotion["_id"];
        Promotion.updateOne({ _id: pid }, promotion, (error, doc) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditMultiplePromotions = ({ ids, update }) => {
    return new Promise(async (resolve, reject) => {
      try {
        Promotion.updateMany({ _id: { $in: ids } }, update, (error, doc) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetNotifications = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let notifications = await Notification.find({});
        resolve(notifications);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.DeleteUserNotification = ({ id, userId }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let updatedUser = await User.findOneAndUpdate(
          { _id: userId },
          {
            $pull: {
              notifications: id,
            },
          },
          { new: true }
        );
        resolve({ updatedUser });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.GetUserNotifications = ({ ids }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let notifications = await Notification.find({
          _id: { $in: ids },
          type: { $in: ["App", "System"] },
          start_date: { $lte: Date.now() },
          status: "Sent",
        });
        resolve(notifications);
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.CreateNotification = (notification) => {
    return new Promise(async (resolve, reject) => {
      try {
        let newNotification = new Notification(notification);
        let receiversIds = [];
        for (let x of notification.receivers) {
          if (x.user_id) {
            receiversIds.push(x.user_id);
          } else {
            let trueReceivers = [];
            if (x === "All") {
              trueReceivers = await PublicUser.find({});
            } else if (x === "All users") {
              trueReceivers = await PublicUser.find({ role: "User" });
            } else if (x === "All admins") {
              trueReceivers = await PublicUser.find({ role: "Administrator" });
            } else if (x === "Inactive users") {
              trueReceivers = await PublicUser.find({ status: "Inactive" });
            } else if (x === "Active users") {
              trueReceivers = await PublicUser.find({ status: "Active" });
            }
            trueReceivers.forEach((r) => {
              receiversIds.push(r.user_id);
            });
          }
        }
        User.updateMany(
          { _id: { $in: receiversIds } },
          {
            $push: {
              notifications: newNotification._id,
            },
          }
        ).exec();
        newNotification.save((error) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true, id: newNotification._id });
          }
        });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.EditNotification = (notification) => {
    return new Promise(async (resolve, reject) => {
      try {
        let pid = notification._id;
        delete notification["_id"];

        let prevNotification = await Notification.findOneAndUpdate(
          { _id: pid },
          notification
        );

        let prevReceiversIds = [];
        for (let x of prevNotification.receivers) {
          if (x.user_id) {
            prevReceiversIds.push(x.user_id);
          } else {
            let trueReceivers = [];
            if (x === "All") {
              trueReceivers = await PublicUser.find({});
            } else if (x === "All users") {
              trueReceivers = await PublicUser.find({ role: "User" });
            } else if (x === "All admins") {
              trueReceivers = await PublicUser.find({ role: "Administrator" });
            } else if (x === "Inactive users") {
              trueReceivers = await PublicUser.find({ status: "Inactive" });
            } else if (x === "Active users") {
              trueReceivers = await PublicUser.find({ status: "Active" });
            }
            trueReceivers.forEach((r) => {
              prevReceiversIds.push(r.user_id);
            });
          }
        }

        let receiversIds = [];
        for (let x of notification.receivers) {
          if (x.user_id) {
            receiversIds.push(x.user_id);
          } else {
            let trueReceivers = [];
            if (x === "All") {
              trueReceivers = await PublicUser.find({});
            } else if (x === "All users") {
              trueReceivers = await PublicUser.find({ role: "User" });
            } else if (x === "All admins") {
              trueReceivers = await PublicUser.find({ role: "Administrator" });
            } else if (x === "Inactive users") {
              trueReceivers = await PublicUser.find({ status: "Inactive" });
            } else if (x === "Active users") {
              trueReceivers = await PublicUser.find({ status: "Active" });
            }
            trueReceivers.forEach((r) => {
              receiversIds.push(r.user_id);
            });
          }
        }

        User.updateMany(
          { _id: { $in: prevReceiversIds } },
          { $pull: { notifications: prevNotification._id } }
        ).exec();

        User.updateMany(
          { _id: { $in: receiversIds } },
          {
            $addToSet: {
              notifications: prevNotification._id,
            },
          },
          (error, doc) => {
            if (error) {
              resolve({ error });
            } else {
              resolve({ success: true });
            }
          }
        );
      } catch (error) {
        console.log("error", error);
        resolve({ error });
      }
    });
  };

  this.EditMultipleNotifications = ({ ids, update }) => {
    return new Promise(async (resolve, reject) => {
      try {
        Notification.updateMany({ _id: { $in: ids } }, update, (error, doc) => {
          if (error) {
            resolve({ error });
          } else {
            resolve({ success: true });
          }
        });
      } catch (error) {
        resolve({ error });
      }
    });
  };

  this.SetSettings = () => {
    return new Promise(async (resolve, reject) => {
      try {
        initialSettings = {
          movies_api_key: "",
          movie_data_api: "",
          latest_movies_api: "",
          no_popular_reviews: 5,
          no_popular_movies: 5,
          no_allowed_reviews: 5,
          no_comment_characters: 400,
          no_review_words: 80,
          bg_image_refresh_time_days: 1,
          bg_image_refresh_time_hours: 0,
          bg_image_refresh_time_minutes: 0,
          FacebookLink: "",
          InstagramLink: "",
          TwitterLink: "",
          LinkedinLink: "",
          current_bg_movie: {
            date_set: Date.now(),
            id: "300671",
            poster_path: "/4qnEeVPM8Yn5dIVC4k4yyjrUXeR.jpg",
            backdrop_path: "/ayDMYGUNVvXS76wQgFwTiUIDNb5.jpg",
            release_date: "2016-01-13",
            overview:
              "An American Ambassador is killed during an attack at a U.S. compound in Libya as a security team struggles to make sense out of the chaos.",
            title: "13 Hours: The Secret Soldiers of Benghazi",
            genres: [
              { id: 28, name: "Action" },
              { id: 36, name: "History" },
              { id: 53, name: "Thriller" },
            ],
            runtime: 144,
          },
        };
        let newSettings = new Settings(initialSettings);
        newSettings.save((error) => {
          if (error) {
            resolve({ error });
          } else {
            resolve(newSettings);
          }
        });
      } catch (error) {
        console.log("error", error);
      }
    });
  };

  this.SetSchedulers = async () => {
    //BACKGROUND CHANGE
    let schedulers = {};
    let backgroundMovieSettings = {
      current_bg_movie: "",
      bg_image_refresh_time_minutes: "",
      bg_image_refresh_time_hours: "",
      bg_image_refresh_time_days: "",
    };
    let apiKey;
    let settings = await Settings.find({});
    if (!settings.length) {
      let res = await this.SetSettings();
      if (res.error) {
        console.log("erro setting settings");
      } else {
        backgroundMovieSettings = {
          current_bg_movie: res.current_bg_movie,
          bg_image_refresh_time_minutes: res.bg_image_refresh_time_minutes,
          bg_image_refresh_time_hours: res.bg_image_refresh_time_hours,
          bg_image_refresh_time_days: res.bg_image_refresh_time_days,
        };
        apiKey = res.movies_api_key;
      }
    } else {
      backgroundMovieSettings = {
        current_bg_movie: settings[0].current_bg_movie,
        bg_image_refresh_time_minutes:
          settings[0].bg_image_refresh_time_minutes,
        bg_image_refresh_time_hours: settings[0].bg_image_refresh_time_hours,
        bg_image_refresh_time_days: settings[0].bg_image_refresh_time_days,
      };
      apiKey = settings[0].movies_api_key;
    }
    const listener = Settings.watch();

    listener.on("change", async (change) => {
      let settings = await Settings.find({});
      if (settings.length) {
        let mySettings = settings[0];
        let newBgMovieSettings = {
          current_bg_movie: mySettings.current_bg_movie,
          bg_image_refresh_time_minutes:
            mySettings.bg_image_refresh_time_minutes,
          bg_image_refresh_time_hours: mySettings.bg_image_refresh_time_hours,
          bg_image_refresh_time_days: mySettings.bg_image_refresh_time_days,
        };

        if (
          JSON.stringify(backgroundMovieSettings) !==
          JSON.stringify(newBgMovieSettings)
        ) {
          backgroundMovieSettings = JSON.parse(
            JSON.stringify(newBgMovieSettings)
          );
          if (mySettings.movies_api_key) {
            let newTimestamp =
              mySettings.current_bg_movie.date_set +
              mySettings.bg_image_refresh_time_minutes * 60000 +
              mySettings.bg_image_refresh_time_hours * 3600000 +
              mySettings.bg_image_refresh_time_days * 86400000;
            if (newTimestamp < Date.now()) {
              this.ChangeBackgroundMovie({ apiKey: mySettings.movies_api_key });
            } else {
              if ("background-change" in schedulers) {
                delete schedulers["background-change"];
              }
              schedulers["background-change"] = schedule.scheduleJob(
                new Date(newTimestamp),
                async () => {
                  this.ChangeBackgroundMovie({
                    apiKey: mySettings.movies_api_key,
                  });
                }
              );
            }
          }
        }
      }
    });

    if (apiKey) {
      let newTimestamp =
        backgroundMovieSettings.current_bg_movie.date_set +
        backgroundMovieSettings.bg_image_refresh_time_minutes * 60000 +
        backgroundMovieSettings.bg_image_refresh_time_hours * 3600000 +
        backgroundMovieSettings.bg_image_refresh_time_days * 86400000;
      if (newTimestamp < Date.now()) {
        this.ChangeBackgroundMovie({ apiKey: apiKey });
      } else {
        schedulers["background-change"] = schedule.scheduleJob(
          new Date(newTimestamp),
          async () => {
            this.ChangeBackgroundMovie({ apiKey: apiKey });
          }
        );
      }
    }

    //NOTIFICATIONS

    const notifier = Notification.watch();

    let notifications = await Notification.find({
      executed: false,
      type: "Email",
    });

    notifications.forEach((x) => {
      if (x.start_date < Date.now()) {
        x.receivers.forEach((r) => {
          SendEmail(
            r.email,
            FormatAdminNotification(x.subject, x.description),
            x.subject
          );
        });
        x.executed = true;
        x.save();
      } else {
        schedulers[`notification-${x._id}`] = schedule.scheduleJob(
          new Date(x.start_date),
          async () => {
            x.receivers.forEach((r) => {
              SendEmail(
                r.email,
                FormatAdminNotification(x.subject, x.description),
                x.subject
              );
            });
          }
        );
      }
    });

    notifier.on("change", (change) => {
      if (change.fullDocument) {
        let n = change.fullDocument;
        if (n.type === "Email") {
          if (schedulers[`notification-${n._id}`]) {
            schedulers[`notification-${n._id}`].cancel();
          }

          schedulers[`notification-${n._id}`] = schedule.scheduleJob(
            new Date(n.start_date),
            async () => {
              n.receivers.forEach((r) => {
                SendEmail(
                  r.email,
                  FormatAdminNotification(n.subject, n.description),
                  n.subject
                );
              });
              Notification.updateOne({ _id: n._id }, { executed: true }).exec();
            }
          );
        }
      }
    });
  };

  this.ChangeBackgroundMovie = ({ apiKey }) => {
    return new Promise(async (resolve, reject) => {
      try {
        let trends = await fetch(
          FormatRequestUrl("/trending/movie/week", [], apiKey)
        ).then((res) => res.json());

        let settings = await Settings.find({});
        if (settings.length) {
          let mySettings = settings[0];
          if (trends.results) {
            let foundMovie = -1;
            let index = 0;
            mySettings.past_bg_movies.push(mySettings.current_bg_movie.id);
            while (foundMovie === -1 && index < trends.results.length) {
              if (
                !mySettings.past_bg_movies.includes(trends.results[index].id)
              ) {
                foundMovie = index;
              }
              index++;
            }

            if (foundMovie === -1) {
              foundMovie = 0;
              mySettings.past_bg_movies = [];
            }

            let movieDetails;
            movieDetails = await getMovieDetails(
              apiKey,
              trends.results[foundMovie].id
            );

            movieDetails.genres = movieDetails.genres
              ? movieDetails.genres
              : movieDetails.genre_ids;

            mySettings.current_bg_movie = Object.assign({}, movieDetails, {
              date_set: Date.now(),
            });
            mySettings.save((er) => {
              if (er) {
                console.log("error changing bg movie", er);
              } else {
                resolve(mySettings.current_bg_movie);
              }
            });
          } else {
            resolve({ error: "no results" });
          }
        } else {
          resolve({ error: "no settings found" });
        }
      } catch (error) {
        console.log("error", error);
        resolve({ error });
      }
    });
  };

  this.SendResetPasswordLink = ({ email }) => {
    return new Promise((resolve, reject) => {
      jwt.sign(
        { data: email },
        process.env.SECRET,
        { expiresIn: "1h" },
        async (err, token) => {
          if (err) {
            resolve({ error: "jwt error reset password" });
          } else {
            SendEmail(
              email,
              `<a href='http://localhost:3000/reset-password/${token}'>Reset Password</a>`,
              "Link to reset your password"
            );
            resolve({ success: true });
          }
        }
      );
    });
  };

  this.ResetPassword = ({ password, token }) => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, process.env.SECRET, async (err, decoded) => {
        if (!err) {
          let email = decoded.data;
          if (email) {
            let hashedPassword = await this.CreatePassword(password);
            let updatedUser = await User.findOneAndUpdate(
              { email },
              { password: hashedPassword }
            );
            if (updatedUser) {
              resolve({ success: true });
            } else {
              resolve({ error: "user doesn't exist" });
            }
          } else {
            resolve({
              error: { message: "Wrong token when reseting password" },
            });
          }
        } else {
          resolve({ error: err });
        }
      });
    });
  };
};
