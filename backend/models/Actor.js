// Actor Schema (Mongoose)
const mongoose = require("mongoose");
const { Schema } = mongoose;
const actorSchema = new Schema({
  name: String,
  movies: [{ type: Schema.Types.ObjectId, ref: "Movie" }],
});

module.exports = mongoose.model("Actor", actorSchema);
