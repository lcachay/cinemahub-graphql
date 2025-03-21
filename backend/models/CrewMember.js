// Crew Member Schema (Mongoose)
const mongoose = require("mongoose");
const { Schema } = mongoose;
const crewMemberSchema = new Schema({
  name: String,
  job: String,
  movies: [{ type: Schema.Types.ObjectId, ref: "Movie" }],
});

module.exports = mongoose.model("CrewMember", crewMemberSchema);
