// Genre Schema (Mongoose)
const mongoose = require("mongoose");
const { Schema } = mongoose;
const genreSchema = new Schema({
  name: String,
});

module.exports = mongoose.model("Genre", genreSchema);
