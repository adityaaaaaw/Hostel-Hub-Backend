// database.js
// This file sets up the connection to our SQLite database.
// SQLite stores the entire database in a single .db file — perfect for learning and small projects.

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// __dirname gives the absolute path of the current file's folder.
// We place the database file at the root of the project inside a "data" folder.
const DB_PATH = path.join(__dirname, "../../data/hostelhub.db");

// Open (or create) the database file.
// sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE means:
//   - Open it for reading and writing
//   - Create the file if it doesn't exist yet
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    // If something goes wrong (e.g., permission issues), log the error and stop.
    console.error("❌ Could not connect to the database:", err.message);
    process.exit(1); // Exit the app with an error code
  } else {
    console.log("✅ Connected to SQLite database at:", DB_PATH);
  }
});

// Export the db object so other files can use it to run queries.
module.exports = db;
