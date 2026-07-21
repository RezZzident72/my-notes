require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

module.exports = {
  development: {
    client: "postgresql",
    connection: connectionString,
    migrations: {
      directory: "./migrations",
    },
  },

  production: {
    client: "postgresql",
    connection: connectionString,
    migrations: {
      directory: "./migrations",
    },
  },
};
