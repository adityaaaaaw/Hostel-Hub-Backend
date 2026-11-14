// setupDb.js
// This file is responsible for two things:
//   1. Creating all database tables (if they don't already exist)
//   2. Inserting sample/seed data for testing
//
// It is called once when the server starts (from app.js).
// Using "IF NOT EXISTS" and "INSERT OR IGNORE" ensures this file is safe to
// run multiple times without duplicating data or throwing errors.

const db = require("./database");

// ─── Helper: Run a SQL statement and return a Promise ────────────────────────
// sqlite3's default API uses callbacks. We wrap it in a Promise so we can use
// async/await for cleaner, easier-to-read code.
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);       // Something went wrong → reject the Promise
      else resolve(this);         // Success → resolve with the statement context
    });
  });
}

// ─── Main Setup Function ──────────────────────────────────────────────────────
async function setupDb() {
  try {
    // ── Step 1: Enable Foreign Key Constraints ──────────────────────────────
    // SQLite does NOT enforce foreign keys by default. We must turn this on
    // manually every time a connection is opened. This prevents orphan records
    // (e.g., an allotment pointing to a resident that doesn't exist).
    await run("PRAGMA foreign_keys = ON");
    console.log("🔑 Foreign key constraints enabled.");

    // ── Step 2: Create Tables ───────────────────────────────────────────────
    // "CREATE TABLE IF NOT EXISTS" is idempotent — it only creates the table
    // the first time. On subsequent server starts, it safely does nothing.

    // --- residents table ---
    // Stores the people living in the hostel.
    await run(`
      CREATE TABLE IF NOT EXISTS residents (
        id    INTEGER PRIMARY KEY AUTOINCREMENT, -- Auto-increments: 1, 2, 3, ...
        name  TEXT    NOT NULL,                  -- Cannot be left blank
        email TEXT    NOT NULL UNIQUE            -- Must be unique across all residents
      )
    `);
    console.log("📋 Table ready: residents");

    // --- rooms table ---
    // Stores the available hostel rooms.
    // is_deleted uses a 0/1 integer as a boolean (SQLite has no BOOLEAN type).
    // This is called "soft delete" — we mark a room as deleted instead of
    // actually removing it, so we don't lose historical allotment records.
    await run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,              -- Room number/name e.g. "101", "A-12"
        block      TEXT    NOT NULL,              -- Block/wing e.g. "A", "B", "North"
        is_deleted INTEGER DEFAULT 0             -- 0 = active, 1 = soft-deleted
      )
    `);
    console.log("🚪 Table ready: rooms");

    // --- allotments table ---
    // Links residents to rooms (who is staying in which room).
    // Uses FOREIGN KEYs to enforce referential integrity:
    //   - resident_id must exist in residents(id)
    //   - room_id must exist in rooms(id)
    await run(`
      CREATE TABLE IF NOT EXISTS allotments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        resident_id INTEGER NOT NULL,
        room_id     INTEGER NOT NULL,
        FOREIGN KEY (resident_id) REFERENCES residents(id),
        FOREIGN KEY (room_id)     REFERENCES rooms(id)
      )
    `);
    console.log("🔗 Table ready: allotments");

    // ── Step 3: Seed Sample Data ────────────────────────────────────────────
    // "INSERT OR IGNORE" skips the insert if a UNIQUE constraint would be
    // violated (e.g., the email already exists). This prevents duplicate rows
    // every time the server restarts.

    // Sample residents
    const sampleResidents = [
      ["Aditya Sharma",   "aditya@hostelhub.com"],
      ["Priya Patel",     "priya@hostelhub.com"],
      ["Rahul Verma",     "rahul@hostelhub.com"],
    ];

    for (const [name, email] of sampleResidents) {
      await run(
        "INSERT OR IGNORE INTO residents (name, email) VALUES (?, ?)",
        [name, email]
      );
    }
    console.log("👤 Sample residents seeded.");

    // Sample rooms
    const sampleRooms = [
      ["101", "A"],
      ["102", "A"],
      ["201", "B"],
      ["202", "B"],
    ];

    for (const [name, block] of sampleRooms) {
      // For rooms we match on both name + block to avoid duplicates,
      // since the name column has no UNIQUE constraint.
      await run(
        `INSERT INTO rooms (name, block)
         SELECT ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM rooms WHERE name = ? AND block = ?
         )`,
        [name, block, name, block]
      );
    }
    console.log("🚪 Sample rooms seeded.");

    console.log("✅ Database setup complete.\n");

  } catch (err) {
    console.error("❌ Database setup failed:", err.message);
    process.exit(1); // Fatal error — stop the server
  }
}

module.exports = setupDb;
