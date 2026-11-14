// residentRoutes.js
// Defines all API endpoints for the "residents" resource.
//
// Endpoints:
//   GET  /residents      → List all residents
//   GET  /residents/:id  → Get one resident by ID
//   POST /residents      → Create a new resident

const express = require("express");
const router = express.Router();
const { run, all, get, isPositiveInt } = require("../db/dbHelpers"); // Reuse the shared Promise helpers

// ─────────────────────────────────────────────────────────────────────────────
// GET /residents
// Returns every resident in the table (no soft-delete on residents).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const residents = await all("SELECT * FROM residents");

    res.json({
      success: true,
      count: residents.length,
      data: residents,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch residents.",
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /residents/:id
// Returns a single resident matching the given ID.
// Returns 404 if no resident with that ID exists.
//
// req.params.id captures the value from the URL — e.g. /residents/2 → id = "2"
// SQLite accepts the string "2" as a number, so no manual conversion needed.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate :id before querying — rejects "abc", "-1", "0", "1.5"
    if (!isPositiveInt(id)) {
      return res.status(400).json({
        success: false,
        message: "Resident id must be a positive integer.",
      });
    }

    const resident = await get(
      "SELECT * FROM residents WHERE id = ?",
      [id]
    );

    if (!resident) {
      // 404 = Not Found
      return res.status(404).json({
        success: false,
        message: `Resident with id ${id} not found.`,
      });
    }

    res.json({ success: true, data: resident });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch resident.",
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /residents
// Creates a new resident.
// Expects JSON body: { "name": "...", "email": "..." }
//
// Validation:
//   - Both name and email must be provided and non-empty.
//
// Duplicate email handling:
//   - The "email" column has a UNIQUE constraint in the database (from setupDb.js).
//   - When a duplicate email is inserted, sqlite3 throws an error with the code
//     "SQLITE_CONSTRAINT". We catch that specific error and return a friendly
//     409 Conflict response instead of a generic 500.
//
// Returns 201 on success.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;

    // ── Input Validation ──────────────────────────────────────────────────
    // .trim() removes surrounding whitespace so "  " doesn't pass validation.
    // typeof guards reject numbers/arrays sent instead of strings (e.g. name: 123).
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    // Basic email format check — must contain "@" and "."
    // (A full regex is more complex; this is beginner-friendly and sufficient for demos.)
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed.includes("@") || !emailTrimmed.includes(".")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // ── Insert into Database ───────────────────────────────────────────────
    // "?" placeholders keep the query safe from SQL Injection.
    // We store email in lowercase to avoid case-sensitive duplicates.
    const result = await run(
      "INSERT INTO residents (name, email) VALUES (?, ?)",
      [name.trim(), emailTrimmed]
    );

    // Fetch the newly created row using the auto-generated ID
    const newResident = await get(
      "SELECT * FROM residents WHERE id = ?",
      [result.lastID]
    );

    // 201 = Created
    res.status(201).json({
      success: true,
      message: "Resident created successfully.",
      data: newResident,
    });

  } catch (err) {
    // ── Duplicate Email Handling ───────────────────────────────────────────
    // SQLite raises an error with message containing "UNIQUE constraint failed"
    // when we try to insert an email that already exists.
    // We check for this specific message to return a 409 Conflict response
    // instead of a generic 500 Internal Server Error.
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({
        success: false,
        message: "A resident with this email already exists.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create resident.",
      error: err.message,
    });
  }
});

module.exports = router;
