const fs = require("fs");
const csvParser = require("csv-parser");
const path = require("path");
const mongoose = require("mongoose");

const datasetPath = path.join(__dirname, "..", "data");

// Models
const Movie = require("../models/Movie");
const Actor = require("../models/Actor");
const Genre = require("../models/Genre");
const CrewMember = require("../models/CrewMember");
const Keyword = require("../models/Keyword");

const BATCH_SIZE = 1000;

async function connectDB() {
  try {
    await mongoose.connect("mongodb://localhost:27017/cinemahub");
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

async function processCSVFiles() {
  await readFileInBatches(
    "movies_metadata",
    "movies_metadata.csv",
    processMoviesBatch
  );
  await readFileInBatches("ratings", "ratings.csv", processRatingsBatch);
  await readFileInBatches("keywords", "keywords.csv", processKeywordsBatch);
  await readFileInBatches("credits", "credits.csv", processCreditsBatch);

  console.log("Data processing complete.");
}

function readFileInBatches(type, fileName, processBatchFn) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(datasetPath, fileName);
    const buffer = [];
    let rowCount = 0;

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        buffer.push(row);
        rowCount++;

        // If we've reached the batch size, process the batch
        if (buffer.length >= BATCH_SIZE) {
          processBatchFn(type, buffer);
          buffer.length = 0; // Clear the buffer
        }
      })
      .on("end", () => {
        if (buffer.length > 0) {
          processBatchFn(type, buffer); // Process the remaining rows
        }
        resolve();
      })
      .on("error", (err) => {
        console.error(`Error reading ${fileName}:`, err);
        reject(err);
      });
  });
}

function parsePythonDictionary(dictionary) {
  let result = dictionary;
  // Escape single quotes inside double-quoted values
  result = result.replace(
    /"([^"]*)"/g,
    (match) => match.replace(/'/g, "__SINGLE_QUOTE__") // Temporarily replace single quotes inside double quotes
  );

  // Escape double quotes inside single-quoted values
  result = result.replace(/'([^']*)'/g, (match) =>
    match.replace(
      /"([^"]+)"/g,
      (subMatch) => subMatch.replace(/"/g, "__DOUBLE_QUOTE__") // Temporarily replace double quotes inside single quotes with placeholder
    )
  );

  // Replace single quotes surrounding full object/values with double quotes
  result = result.replace(/'([^']*)'/g, (match, p1) => {
    // Ensure empty strings remain properly formatted as ""
    return p1 === "" ? '""' : `"${p1}"`;
  });

  // Restore single quotes back to their original state inside double quotes
  result = result.replace(/__SINGLE_QUOTE__/g, "'");

  // Restore double quotes to single quotes inside single-quoted values
  result = result.replace(/__DOUBLE_QUOTE__/g, "'");

  // Replace any special characters (e.g., \xa0) with proper escape sequences
  result = result.replace(/\\xa0/g, "\\u00a0");

  // Replace Python `None`, `True`, `False` with JSON equivalents
  result = result
    .replace(/\bNone\b/g, "null")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false");

  try {
    result = JSON.parse(result);
  } catch (error) {
    console.log(dictionary, result);
  }

  return result;
}

async function addGenresToMovie(movie, genreNames) {
  if (typeof genreNames === "string") {
    try {
      genreNames = parsePythonDictionary(genreNames);
    } catch (error) {
      console.error("Failed to parse genreNames:", genreNames);
      genreNames = [];
    }
  }

  if (!Array.isArray(genreNames)) {
    console.error("Expected an array, but got:", genreNames);
    genreNames = [];
  }

  const genrePromises = genreNames.map(async (genre) => {
    const genreName = genre.name || genre;
    let genreDoc = await Genre.findOne({ name: genreName });

    if (!genreDoc) {
      genreDoc = new Genre({ name: genreName });
      await genreDoc.save();
    }

    if (!movie.genres.includes(genreDoc._id)) {
      movie.genres.push(genreDoc._id);
    }
  });

  await Promise.all(genrePromises);
}

async function processMoviesBatch(type, batch) {
  const bulkOps = [];

  for (const row of batch) {
    const existingMovie = await Movie.findOne({ movieId: row.movieId });

    if (!existingMovie) {
      // If the movie does not exist, create a new movie object
      const newMovie = {
        movieId: row.id,
        title: row.title,
        release_date: row.release_date,
        overview: row.overview,
        budget: row.budget,
        revenue: row.revenue,
        genres: [],
        actors: [],
        crew: [],
        keywords: [],
      };

      // Add genres to the new movie object
      await addGenresToMovie(newMovie, row.genres);

      bulkOps.push({
        insertOne: {
          document: newMovie,
        },
      });
    } else {
      // If the movie exists, just update it
      const updatedMovie = {
        movieId: row.id,
        title: row.title,
        release_date: row.release_date,
        overview: row.overview,
        budget: row.budget,
        revenue: row.revenue,
        genres: [],
        actors: [],
        crew: [],
        keywords: [],
      };

      // Add genres
      await addGenresToMovie(updatedMovie, row.genres);

      bulkOps.push({
        updateOne: {
          filter: { movieId: row.movieId },
          update: {
            $set: updatedMovie,
          },
        },
      });
    }
  }

  if (bulkOps.length) {
    await Movie.bulkWrite(bulkOps);
  }
}

async function processKeywordsBatch(type, batch) {
  for (const row of batch) {
    const movieId = row.id;
    let parsedKeywords = [];

    try {
      parsedKeywords = parsePythonDictionary(row.keywords);
    } catch (error) {
      continue;
    }

    // Find the Movie document
    const movie = await Movie.findOne({ movieId }).select("_id");

    if (!movie) {
      continue;
    }
    if (!movie.keywords) {
      movie.keywords = [];
    }

    for (const { name } of parsedKeywords) {
      let keyword = await Keyword.findOne({ name });

      if (!keyword) {
        keyword = new Keyword({ name, movies: [movie._id] });
        await keyword.save();
      } else {
        if (!keyword.movies.includes(movie._id)) {
          keyword.movies.push(movie._id);
          await keyword.save();
        }
      }

      if (!movie.keywords.includes(keyword._id)) {
        movie.keywords.push(keyword._id);
        await movie.save();
      }
    }
  }
}

async function processRatingsBatch(type, batch) {
  if (!batch.length) return;

  const movieRatingsMap = new Map();
  const movieIds = batch.map((row) => row.movieId);

  // Step 1: Fetch all movies in one query
  const movies = await Movie.find({ movieId: { $in: movieIds } }).select(
    "_id movieId"
  );

  const movieIdToMongoIdMap = new Map();
  movies.forEach((movie) => {
    movieIdToMongoIdMap.set(movie.movieId, movie._id);
  });

  // Accumulate ratings for each movie in the batch
  for (const row of batch) {
    const movieId = row.movieId;
    const movie = movieIdToMongoIdMap.get(movieId);

    if (!movie) {
      continue;
    }
    const rating = parseFloat(row.rating);
    if (isNaN(rating)) {
      console.warn(
        `Invalid rating (${rating}) for movie ${movieId}, skipping.`
      );
      continue;
    }

    if (!movieRatingsMap.has(movieId)) {
      movieRatingsMap.set(movieId, { totalRating: 0, count: 0 });
    }

    const movieData = movieRatingsMap.get(movieId);
    movieData.totalRating += rating;
    movieData.count += 1;
  }

  const bulkOps = [];
  for (const [movieId, { totalRating, count }] of movieRatingsMap.entries()) {
    const averageRating = totalRating / count;

    bulkOps.push({
      updateOne: {
        filter: { movieId: movieId },
        update: { $set: { rating: averageRating } },
      },
    });
  }

  if (bulkOps.length) {
    await Movie.bulkWrite(bulkOps);
  }

  movieRatingsMap.clear();
}

async function processCreditsBatch(type, batch) {
  if (!batch.length) return;
  const actorPromises = [];
  const crewPromises = [];

  for (const row of batch) {
    const movie = await Movie.findOne({ movieId: row.id }).select("_id");
    if (!movie) {
      continue;
    }

    // Process cast members (actors)
    const cast = parsePythonDictionary(row.cast);
    const actorPromisesBatch = cast.map(async (actor) => {
      const existingActor = await Actor.findOne({ name: actor.name });

      if (!existingActor) {
        const newActor = new Actor({
          name: actor.name,
          movies: [movie._id],
        });
        await newActor.save();

        await Movie.updateOne(
          { _id: movie._id },
          { $addToSet: { actors: newActor._id } }
        );
      } else {
        await Actor.updateOne(
          { _id: existingActor._id },
          { $addToSet: { movies: movie._id } }
        );
        await Movie.updateOne(
          { _id: movie._id },
          { $addToSet: { actors: existingActor._id } }
        );
      }
    });

    actorPromises.push(...actorPromisesBatch);

    const crew = parsePythonDictionary(row.crew);
    // Process crew members
    const crewPromisesBatch = crew.map(async (crewMember) => {
      const existingCrewMember = await CrewMember.findOne({
        name: crewMember.name,
        job: crewMember.job,
      });

      if (!existingCrewMember) {
        const newCrewMember = new CrewMember({
          name: crewMember.name,
          job: crewMember.job,
          movies: [movie._id],
        });
        await newCrewMember.save();
        await Movie.updateOne(
          { _id: movie._id },
          { $addToSet: { crew: newCrewMember._id } }
        );
      } else {
        await CrewMember.updateOne(
          { _id: existingCrewMember._id },
          { $addToSet: { movies: movie._id } }
        );
        await Movie.updateOne(
          { _id: movie._id },
          { $addToSet: { crew: existingCrewMember._id } }
        );
      }
    });

    crewPromises.push(...crewPromisesBatch);
  }

  await Promise.all([...actorPromises, ...crewPromises]);
}

async function startMigration() {
  await connectDB();
  processCSVFiles()
    .then(() => {
      console.log("All files processed successfully!");
    })
    .catch((err) => {
      console.error("Error during batch processing:", err);
    });
}

startMigration();
