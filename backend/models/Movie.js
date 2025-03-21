// Movie Schema (Mongoose)
const mongoose = require("mongoose");
const { Schema } = mongoose;

const movieSchema = new Schema({
  movieId: String,
  title: String,
  budget: Number,
  revenue: Number,
  release_date: Date,
  overview: String,
  runtime: Number,
  genres: [{ type: Schema.Types.ObjectId, ref: "Genre", default: [] }],
  actors: [{ type: Schema.Types.ObjectId, ref: "Actor", default: [] }],
  crew: [{ type: Schema.Types.ObjectId, ref: "CrewMember", default: [] }],
  keywords: [{ type: Schema.Types.ObjectId, ref: "Keyword", default: [] }],
  rating: Number,
});

module.exports = mongoose.model("Movie", movieSchema);
