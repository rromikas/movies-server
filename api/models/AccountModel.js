const mongoose = require("mongoose");

const AccountModel = new mongoose.Schema({
  webUrl: { type: String, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
const Account = mongoose.model("Account", AccountModel);

module.exports = Account;
