// roomRoutes.js
// Defines all CRUD API endpoints for the "rooms" resource.
//
// Endpoints implemented here:
//   GET    /rooms          → List all active rooms (optional ?block= filter)
//   GET    /rooms/:id      → Get a single room by ID
//   POST   /rooms          → Create a new room
//   PUT    /rooms/:id      → Update a room's name and block
//   DELETE /rooms/:id      → Soft-delete a room (sets is_deleted = 1)
//   POST   /rooms/:id/restore → Restore a soft-deleted room

const express = require("express");
const router = express.Router();
const { run, all, get, isPositiveInt } = require("../db/dbHelpers"); // Reusable DB Promise helpers

// ─────────────────────────────────────────────────────────────────────────────
// GET /rooms
// Returns all rooms that are NOT soft-deleted (is_deleted = 0).
// Optionally filter by block using ?block=A query parameter.
//
// Example requests:
//   GET /rooms          → all active rooms
//   GET /rooms?block=A  → only rooms in Block A
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { block } = req.query; // Read the optional ?block= query parameter

    let sql;
    let params;

    if (block) {
      // If a block filter was provided, add a WHERE clause for it.
      // We use UPPER() on both sides so the search is case-insensitive:
      // ?block=a and ?block=A both return the same results.
      sql    = "SELECT * FROM rooms WHERE is_deleted = 0 AND UPPER(block) = UPPER(?)";
      params = [block];
    } else {
      // No filter — return every active room
      sql    = "SELECT * FROM rooms WHERE is_deleted = 0";
      params = [];
    }

    const rooms = await all(sql, params);

    res.json({
      success: true,
      count: rooms.length,   // Handy for the client to know how many results came back
      data: rooms,
    });

  } catch (err) {
    // 500 = Internal Server Error — something unexpected broke on the server side
    res.status(500).json({ success: false, message: "Failed to fetch rooms.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /rooms/:id
// Returns a single room matching the given ID.
// Returns 404 if the room doesn't exist OR has been soft-deleted.
//
// :id is a URL parameter — Express captures it in req.params.id
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that :id is a positive integer before hitting the database
    if (!isPositiveInt(id)) {
      return res.status(400).json({ success: false, message: "Room id must be a positive integer." });
    }

    // Fetch the room — but only if it's active (is_deleted = 0)
    const room = await get(
      "SELECT * FROM rooms WHERE id = ? AND is_deleted = 0",
      [id]
    );

    if (!room) {
      // 404 = Not Found — no active room with this ID exists
      return res.status(404).json({ success: false, message: `Room with id ${id} not found.` });
    }

    res.json({ success: true, data: room });

  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch room.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /rooms
// Creates a new room.
// Expects JSON body: { "name": "101", "block": "A" }
// Returns 201 Created on success.
//
// Validation: both "name" and "block" must be provided and non-empty.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    // Destructure the expected fields from the request body.
    // req.body is populated by the express.json() middleware in app.js.
    const { name, block } = req.body;

    // ── Input Validation ──────────────────────────────────────────────────
    // .trim() removes leading/trailing whitespace so "  " doesn't pass validation.
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Room name is required." });
    }
    if (!block || typeof block !== "string" || !block.trim()) {      return res.status(400).json({ success: false, message: "Block is required." });
    }

    // ── Insert into DB ────────────────────────────────────────────────────
    // "?" placeholders prevent SQL Injection — never concatenate user input into SQL strings!
    const result = await run(
      "INSERT INTO rooms (name, block) VALUES (?, ?)",
      [name.trim(), block.trim().toUpperCase()] // Normalize block to uppercase for consistency
    );

    // result.lastID contains the auto-generated ID of the new row
    const newRoom = await get("SELECT * FROM rooms WHERE id = ?", [result.lastID]);

    // 201 = Created — the standard status code for a successful resource creation
    res.status(201).json({
      success: true,
      message: "Room created successfully.",
      data: newRoom,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create room.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /rooms/:id
// Updates an existing room's name and/or block.
// Expects JSON body with at least one of: { "name": "...", "block": "..." }
// Returns 404 if the room doesn't exist or is soft-deleted.
// Returns 200 on success.
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, block } = req.body;

    // ── Input Validation ──────────────────────────────────────────────────
    if (!isPositiveInt(id)) {
      return res.status(400).json({ success: false, message: "Room id must be a positive integer." });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Room name is required." });
    }
    if (!block || typeof block !== "string" || !block.trim()) {      return res.status(400).json({ success: false, message: "Block is required." });
    }

    // ── Check room exists and is active ───────────────────────────────────
    const existing = await get(
      "SELECT * FROM rooms WHERE id = ? AND is_deleted = 0",
      [id]
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: `Room with id ${id} not found.` });
    }

    // ── Perform the Update ────────────────────────────────────────────────
    await run(
      "UPDATE rooms SET name = ?, block = ? WHERE id = ?",
      [name.trim(), block.trim().toUpperCase(), id]
    );

    // Fetch the updated row to return it in the response
    const updatedRoom = await get("SELECT * FROM rooms WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Room updated successfully.",
      data: updatedRoom,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update room.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /rooms/:id
// Performs a SOFT DELETE — sets is_deleted = 1 instead of removing the row.
// This preserves historical allotment data linked to this room.
// Returns 404 if the room doesn't exist or is already soft-deleted.
// Returns 200 on success.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInt(id)) {
      return res.status(400).json({ success: false, message: "Room id must be a positive integer." });
    }

    // Only soft-delete a room that currently exists and is active
    const existing = await get(
      "SELECT * FROM rooms WHERE id = ? AND is_deleted = 0",
      [id]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Room with id ${id} not found or already deleted.`,
      });
    }

    // Set is_deleted = 1 — the room stays in the database but is hidden from normal queries
    await run("UPDATE rooms SET is_deleted = 1 WHERE id = ?", [id]);

    res.json({
      success: true,
      message: `Room "${existing.name}" (Block ${existing.block}) has been soft-deleted.`,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete room.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /rooms/:id/restore
// Restores a previously soft-deleted room by setting is_deleted = 0.
// Returns 404 if the room doesn't exist OR is already active (not deleted).
// Returns 200 on success.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInt(id)) {
      return res.status(400).json({ success: false, message: "Room id must be a positive integer." });
    }

    // Only restore a room that is currently soft-deleted (is_deleted = 1)
    const existing = await get(
      "SELECT * FROM rooms WHERE id = ? AND is_deleted = 1",
      [id]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Room with id ${id} not found or is not deleted.`,
      });
    }

    await run("UPDATE rooms SET is_deleted = 0 WHERE id = ?", [id]);

    const restoredRoom = await get("SELECT * FROM rooms WHERE id = ?", [id]);

    res.json({
      success: true,
      message: `Room "${restoredRoom.name}" (Block ${restoredRoom.block}) has been restored.`,
      data: restoredRoom,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to restore room.", error: err.message });
  }
});

module.exports = router;
