// dbHelpers.js
// Reusable Promise-based wrappers around sqlite3's callback API.
//
// sqlite3 uses Node.js-style callbacks (err, result) which can get messy
// when chaining multiple queries. These helpers let us use async/await instead.
//
// We define them here once and import them in any route file that needs them.

const db = require("./database");

// ─── run(sql, params) ─────────────────────────────────────────────────────────
// Use for: INSERT, UPDATE, DELETE — queries that don't return rows.
// Resolves with the sqlite3 statement context (has .lastID, .changes).
//   - this.lastID   → the auto-generated ID of the last INSERT
//   - this.changes  → number of rows affected by UPDATE / DELETE
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // "this" is the statement context, NOT the db
    });
  });
}

// ─── all(sql, params) ─────────────────────────────────────────────────────────
// Use for: SELECT queries that return multiple rows.
// Resolves with an array of row objects (empty array if no results).
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ─── get(sql, params) ─────────────────────────────────────────────────────────
// Use for: SELECT queries that return a single row (e.g. lookup by ID).
// Resolves with one row object, or undefined if no match found.
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row); // undefined if no row matched
    });
  });
}

// ─── isPositiveInt(value) ─────────────────────────────────────────────────────
// Shared input validator for ID parameters and foreign-key fields.
// Returns true only when value is a whole number greater than zero.
//
// Why this matters:
//   - URL params like :id arrive as strings ("3", "abc", "-1", "0")
//   - Body fields like resident_id may arrive as numbers OR strings
//   - We want to accept: 1, 2, "3"
//   - We want to reject: 0, -5, "abc", "", null, undefined, 1.5
//
// Number(value)   → converts "3" → 3, "abc" → NaN, "" → 0
// Number.isInteger → rejects 1.5, NaN, Infinity
// > 0             → rejects 0 and negatives
function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

module.exports = { run, all, get, isPositiveInt };
