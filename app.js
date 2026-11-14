// app.js
// This is the main entry point of our Express application.
// It wires everything together: middleware, database, and routes.

const express = require("express");   // Import the Express framework
const setupDb = require("./src/db/setupDb"); // Import the database setup function
const indexRoute = require("./src/routes/indexRoute"); // Import our routes
const roomRoutes     = require("./src/routes/roomRoutes");     // Import room CRUD routes
const residentRoutes  = require("./src/routes/residentRoutes");  // Import resident routes
const allotmentRoutes = require("./src/routes/allotmentRoutes"); // Import allotment routes

// Create the Express application instance
const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
// Middleware are functions that run on every incoming request before it
// reaches the route handler.

// express.json() automatically parses incoming request bodies with JSON data,
// making the data available as req.body in route handlers.
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
// Mount the index route at the root URL.
// Any request to "/" will be handled by indexRoute.js
app.use("/", indexRoute);
app.use("/rooms",     roomRoutes);     // Mount all room endpoints under /rooms
app.use("/residents",  residentRoutes);  // Mount all resident endpoints under /residents
app.use("/allotments", allotmentRoutes); // Mount all allotment endpoints under /allotments

// ─── Database Setup + Start Server ───────────────────────────────────────────
// We call setupDb() BEFORE starting the server.
// This ensures all tables exist and seed data is inserted before any
// API requests can come in. setupDb() returns a Promise, so we use
// async/await to wait for it to finish.
const PORT = process.env.PORT || 3000;

async function startServer() {
  await setupDb();  // Create tables and seed data first

  app.listen(PORT, () => {
    console.log(`🚀 HostelHub server is running at http://localhost:${PORT}`);
  });
}

startServer();
