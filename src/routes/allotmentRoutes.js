// allotmentRoutes.js
// Defines all API endpoints for the "allotments" resource.
//
// An allotment is the record that links a resident to a room.
// Think of it as the "booking" or "assignment" table.
//
// Endpoints:
//   GET    /allotments      → List all allotments (with JOIN data)
//   GET    /allotments/:id  → Get one allotment by ID
//   POST   /allotments      → Create a new allotment
//   DELETE /allotments/:id  → Remove (hard-delete) an allotment

const express = require("express");
const router  = express.Router();
const { run, all, get, isPositiveInt } = require("../db/dbHelpers");

// ─────────────────────────────────────────────────────────────────────────────
// THE JOIN QUERY — used by both GET /allotments and GET /allotments/:id
// ─────────────────────────────────────────────────────────────────────────────
//
// A JOIN combines rows from multiple tables based on a matching column.
// Without a JOIN, the allotments table only stores IDs (resident_id, room_id).
// With a JOIN, we enrich the response with the actual names from other tables.
//
// How it works step-by-step:
//
//   allotments                       residents               rooms
//   ┌────┬─────────────┬─────────┐   ┌────┬──────────────┐  ┌────┬──────┬───────┐
//   │ id │ resident_id │ room_id │   │ id │ name         │  │ id │ name │ block │
//   ├────┼─────────────┼─────────┤   ├────┼──────────────┤  ├────┼──────┼───────┤
//   │  1 │           1 │       2 │   │  1 │ Aditya Sharma│  │  2 │  102 │   A   │
//   └────┴─────────────┴─────────┘   └────┴──────────────┘  └────┴──────┴───────┘
//
//   INNER JOIN residents ON allotments.resident_id = residents.id
//     → Fetches the resident whose id matches resident_id
//
//   INNER JOIN rooms ON allotments.room_id = rooms.id
//     → Fetches the room whose id matches room_id
//
//   WHERE rooms.is_deleted = 0
//     → Excludes allotments linked to soft-deleted rooms
//
// Result row: { id:1, resident_id:1, resident_name:"Aditya Sharma",
//               room_id:2, room_name:"102", block:"A" }
//
// We use aliases (AS) to rename columns so the response is clear and readable.
// ─────────────────────────────────────────────────────────────────────────────

const JOIN_QUERY = `
  SELECT
    a.id               AS id,
    a.resident_id      AS resident_id,
    r.name             AS resident_name,
    a.room_id          AS room_id,
    rm.name            AS room_name,
    rm.block           AS block
  FROM allotments AS a
  INNER JOIN residents AS r  ON a.resident_id = r.id
  INNER JOIN rooms     AS rm ON a.room_id     = rm.id
  WHERE rm.is_deleted = 0
`;

// ─────────────────────────────────────────────────────────────────────────────
// GET /allotments
// Returns all allotments with enriched resident and room data via JOIN.
// Soft-deleted rooms are automatically excluded by the WHERE clause.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const allotments = await all(JOIN_QUERY);

    res.json({
      success: true,
      count: allotments.length,
      data: allotments,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch allotments.",
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /allotments/:id
// Returns a single allotment by ID using the same JOIN query.
// Returns 404 if the allotment doesn't exist OR its room is soft-deleted.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInt(id)) {
      return res.status(400).json({
        success: false,
        message: "Allotment id must be a positive integer.",
      });
    }

    // Append a filter for the specific allotment ID to the shared JOIN query
    const allotment = await get(
      JOIN_QUERY + " AND a.id = ?",
      [id]
    );

    if (!allotment) {
      return res.status(404).json({
        success: false,
        message: `Allotment with id ${id} not found.`,
      });
    }

    res.json({ success: true, data: allotment });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch allotment.",
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /allotments
// Creates a new allotment (assigns a resident to a room).
// Expects JSON body: { "resident_id": 1, "room_id": 2 }
//
// Validation steps (in order):
//   1. Both resident_id and room_id must be provided.
//   2. The resident must exist in the residents table.
//   3. The room must exist AND not be soft-deleted.
//   4. The same resident must not already be allotted to the same room.
//
// Returns 201 on success.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { resident_id, room_id } = req.body;

    // ── Step 1: Presence Validation ───────────────────────────────────────
    // isPositiveInt rejects: missing, 0, negatives, decimals, strings like "abc"
    // Accepts: 1, 2, "3" (URL params arrive as strings, that's fine)
    if (!isPositiveInt(resident_id)) {
      return res.status(400).json({
        success: false,
        message: "A valid resident_id is required.",
      });
    }

    if (!isPositiveInt(room_id)) {
      return res.status(400).json({
        success: false,
        message: "A valid room_id is required.",
      });
    }

    // ── Step 2: Verify the resident exists ────────────────────────────────
    const resident = await get(
      "SELECT id, name FROM residents WHERE id = ?",
      [resident_id]
    );

    if (!resident) {
      return res.status(404).json({
        success: false,
        message: `Resident with id ${resident_id} does not exist.`,
      });
    }

    // ── Step 3: Verify the room exists and is not soft-deleted ────────────
    const room = await get(
      "SELECT id, name, block FROM rooms WHERE id = ? AND is_deleted = 0",
      [room_id]
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Room with id ${room_id} does not exist or has been deleted.`,
      });
    }

    // ── Step 4: Prevent duplicate allotments ──────────────────────────────
    // Check if this exact (resident_id, room_id) pair already exists.
    // We don't want to allot the same person to the same room twice.
    const existing = await get(
      "SELECT id FROM allotments WHERE resident_id = ? AND room_id = ?",
      [resident_id, room_id]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Resident "${resident.name}" is already allotted to room "${room.name}" (Block ${room.block}).`,
      });
    }

    // ── Step 5: Create the allotment ──────────────────────────────────────
    const result = await run(
      "INSERT INTO allotments (resident_id, room_id) VALUES (?, ?)",
      [resident_id, room_id]
    );

    // Fetch the full enriched allotment using the JOIN query
    const newAllotment = await get(
      JOIN_QUERY + " AND a.id = ?",
      [result.lastID]
    );

    res.status(201).json({
      success: true,
      message: `Resident "${resident.name}" successfully allotted to room "${room.name}" (Block ${room.block}).`,
      data: newAllotment,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create allotment.",
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /allotments/:id
// Hard-deletes an allotment record (physically removes it from the table).
//
// Unlike rooms (which use soft delete to preserve history), allotments are
// removed outright — removing an allotment means the resident is simply
// no longer assigned to that room.
//
// Returns 404 if the allotment doesn't exist.
// Returns 200 on successful deletion.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isPositiveInt(id)) {
      return res.status(400).json({
        success: false,
        message: "Allotment id must be a positive integer.",
      });
    }

    // Check the allotment exists before trying to delete it
    // We query the base table directly (no JOIN needed here — just checking existence)
    const existing = await get(
      "SELECT a.id, r.name AS resident_name, rm.name AS room_name, rm.block FROM allotments a INNER JOIN residents r ON a.resident_id = r.id INNER JOIN rooms rm ON a.room_id = rm.id WHERE a.id = ?",
      [id]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Allotment with id ${id} not found.`,
      });
    }

    // Physically remove the row from the allotments table
    await run("DELETE FROM allotments WHERE id = ?", [id]);

    res.json({
      success: true,
      message: `Allotment removed: "${existing.resident_name}" is no longer assigned to room "${existing.room_name}" (Block ${existing.block}).`,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete allotment.",
      error: err.message,
    });
  }
});

module.exports = router;
