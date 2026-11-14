// indexRoute.js
// This file defines the routes for the base URL ("/").
// Keeping routes in separate files makes the codebase easier to manage as it grows.

const express = require("express");
const router = express.Router(); // Create a mini-app that handles routes

// GET /
// This is the welcome route. When someone visits the root URL of our API,
// they get a friendly JSON message back.
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to HostelHub API 🏠",
    description: "A backend system for managing hostel rooms, students, and complaints.",
    version: "1.0.0",
  });
});

// Export the router so app.js can use it
module.exports = router;
