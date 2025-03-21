require("dotenv").config();
const { ApolloServer } = require("apollo-server");
const mongoose = require("mongoose");
const typeDefs = require("./graphql/schema");
const resolvers = require("./graphql/resolver");

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/cinemahub");
    console.log("Connected to MongoDB");
    console.log(typeDefs);
    console.log(resolvers);

    // Create Apollo Server
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      // cors: {
      //   origin: (origin, callback) => {
      //     if (origin === "http://localhost:3000") {
      //       callback(null, true);
      //     } else {
      //       callback(new Error("Not allowed by CORS"), false);
      //     }
      //   },
      //   methods: "GET,POST,PUT,DELETE",
      //   allowedHeaders: "Content-Type,Authorization",
      // },
    });

    // Start Apollo Server
    const { url } = await server.listen({ port: 4000 });
    console.log(`Server is running at ${url}`);
  } catch (err) {
    console.error("Error starting server:", err);
  }
}

startServer();
