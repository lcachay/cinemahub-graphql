const { gql } = require("apollo-server");

const typeDefs = gql`
  type Movie {
    _id: ID!
    movieId: String
    title: String
    budget: Int
    revenue: Int
    release_date: String
    overview: String
    runtime: Int
    genres: [Genre]
    actors: [Actor]
    crew: [CrewMember]
    keywords: [Keyword]
    rating: Int
  }

  type Keyword {
    _id: ID!
    name: String
    movies: [Movie]
  }

  type Actor {
    _id: ID!
    name: String
    movies: [Movie]
  }

  type CrewMember {
    _id: ID!
    name: String
    job: String
    movies: [Movie]
  }

  type Genre {
    _id: ID!
    name: String
  }

  input MovieInput {
    title: String
    budget: Int
    revenue: Int
    release_date: String
    overview: String
    runtime: Int
    genres: [ID]
    actors: [ID]
    crew: [ID]
    keywords: [ID]
    rating: Int
  }

  type Query {
    movie(id: ID!): Movie
    movies: [Movie]
    keywords: [Keyword]
    actors: [Actor]
    crewMembers: [CrewMember]
    genres: [Genre]
  }

  type Mutation {
    addMovie(movieInput: MovieInput): Movie
    addKeywordToMovie(movieId: ID!, keywordId: ID!): Movie
    addActorToMovie(movieId: ID!, actorId: ID!): Movie
    addCrewToMovie(movieId: ID!, crewId: ID!): Movie
    addGenreToMovie(movieId: ID!, genreId: ID!): Movie
  }
`;

module.exports = typeDefs;
