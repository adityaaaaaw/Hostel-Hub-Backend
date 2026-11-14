# 🏠 HostelHub — Backend API

HostelHub is a beginner-friendly, modular RESTful API built with **Node.js**, **Express.js**, and **SQLite** for managing hostel residents, rooms, and room allotments.

Developed for Backend Development Fundamentals coursework and demonstrations.

---

## 🌟 Key Features

- **Modular Architecture**: Separate routing layers for index, rooms, residents, and allotments.
- **Relational Integrity**: Enforced SQLite foreign key constraints (`PRAGMA foreign_keys = ON`).
- **Soft Delete & Restore**: Soft deletion on rooms to preserve historical allotment records.
- **Enriched Data via SQL JOIN**: Allotment queries combine tables to present resident names, room numbers, and blocks in a single payload.
- **Robust Input Validation**: Guard clauses validating positive integer IDs, non-empty text, and email formats.
- **Conflict Prevention**: Unique email constraint enforcement and duplicate allotment prevention (HTTP 409).
- **Environment Flexibility**: Configured to listen on `process.env.PORT || 3000`.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3 (`sqlite3` driver)
- **Dev Tool**: Nodemon (auto-reloading)

---

## 📂 Project Structure

```text
hostelhub/
├── data/                                # Local SQLite data store (git-ignored)
│   └── hostelhub.db
├── src/
│   ├── db/
│   │   ├── database.js                  # SQLite database connection
│   │   ├── dbHelpers.js                 # Promise wrappers (run, all, get, isPositiveInt)
│   │   └── setupDb.js                   # Schema definitions & duplicate-safe seeding
│   └── routes/
│       ├── indexRoute.js                # Welcome route (GET /)
│       ├── roomRoutes.js                # Room CRUD, soft-delete & restore
│       ├── residentRoutes.js            # Resident CRUD
│       └── allotmentRoutes.js           # Allotment management with SQL JOIN
├── .gitignore                           # Git ignore definitions
├── app.js                               # Application entry point & server setup
├── HostelHub.postman_collection.json    # Complete Postman test collection
├── package.json                         # Dependencies & scripts
└── README.md                            # Documentation
```

---

## 🗄️ Database Schema

### 1. `residents` Table
Stores registered hostel residents.
```sql
CREATE TABLE IF NOT EXISTS residents (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
```

### 2. `rooms` Table
Stores available hostel rooms with soft delete support.
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  block      TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);
```

### 3. `allotments` Table
Junction table linking residents to rooms.
```sql
CREATE TABLE IF NOT EXISTS allotments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  resident_id INTEGER NOT NULL,
  room_id     INTEGER NOT NULL,
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);
```

---

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GITHUB_REPOSITORY_URL>
   cd hostelhub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   *Alternatively, start in production mode:*
   ```bash
   npm start
   ```

The server will automatically create `data/hostelhub.db`, enable foreign keys, run table migrations, seed initial sample data, and start listening on `http://localhost:3000`.

---

## 📡 API Endpoints

### General
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Welcome message and API overview |

---

### Rooms (`/rooms`)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/rooms` | List all active rooms (optional `?block=A`) | 200, 500 |
| `GET` | `/rooms/:id` | Get single active room by ID | 200, 400, 404, 500 |
| `POST` | `/rooms` | Add a new room | 201, 400, 500 |
| `PUT` | `/rooms/:id` | Update room name and block | 200, 400, 404, 500 |
| `DELETE` | `/rooms/:id` | Soft-delete a room (`is_deleted = 1`) | 200, 400, 404, 500 |
| `POST` | `/rooms/:id/restore`| Restore soft-deleted room (`is_deleted = 0`) | 200, 400, 404, 500 |

#### Example: POST /rooms
**Request Body:**
```json
{
  "name": "301",
  "block": "C"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Room created successfully.",
  "data": {
    "id": 5,
    "name": "301",
    "block": "C",
    "is_deleted": 0
  }
}
```

---

### Residents (`/residents`)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/residents` | List all residents | 200, 500 |
| `GET` | `/residents/:id` | Get resident by ID | 200, 400, 404, 500 |
| `POST` | `/residents` | Create resident | 201, 400, 409, 500 |

#### Example: POST /residents
**Request Body:**
```json
{
  "name": "Sneha Iyer",
  "email": "sneha@hostelhub.com"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Resident created successfully.",
  "data": {
    "id": 4,
    "name": "Sneha Iyer",
    "email": "sneha@hostelhub.com"
  }
}
```

---

### Allotments (`/allotments`)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/allotments` | List all active allotments (with SQL JOIN) | 200, 500 |
| `GET` | `/allotments/:id` | Get single allotment (with SQL JOIN) | 200, 400, 404, 500 |
| `POST` | `/allotments` | Assign resident to room | 201, 400, 404, 409, 500 |
| `DELETE` | `/allotments/:id` | Remove an allotment | 200, 400, 404, 500 |

#### Example: POST /allotments
**Request Body:**
```json
{
  "resident_id": 1,
  "room_id": 1
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "message": "Resident \"Aditya Sharma\" successfully allotted to room \"101\" (Block A).",
  "data": {
    "id": 1,
    "resident_id": 1,
    "resident_name": "Aditya Sharma",
    "room_id": 1,
    "room_name": "101",
    "block": "A"
  }
}
```

---

## 🔍 Deep Dive: Core Concepts

### 1. Soft Delete & Restore
In production systems, deleting a record permanently can corrupt historical references. In HostelHub:
- Calling `DELETE /rooms/:id` sets `is_deleted = 1` rather than executing an SQL `DELETE`.
- Active queries filter records with `WHERE is_deleted = 0`.
- Calling `POST /rooms/:id/restore` resets `is_deleted = 0`.

### 2. SQL JOIN Query
The `allotments` table holds only foreign keys (`resident_id`, `room_id`). To return human-readable records, queries use an `INNER JOIN`:
```sql
SELECT
  a.id AS id,
  a.resident_id AS resident_id,
  r.name AS resident_name,
  a.room_id AS room_id,
  rm.name AS room_name,
  rm.block AS block
FROM allotments AS a
INNER JOIN residents AS r ON a.resident_id = r.id
INNER JOIN rooms AS rm ON a.room_id = rm.id
WHERE rm.is_deleted = 0;
```
If a room is soft-deleted, its allotments are automatically omitted from GET requests without deleting allotment data.

---

## 🧪 Postman Testing

A pre-configured Postman collection is included in the root directory: `HostelHub.postman_collection.json`.

1. Open Postman and click **Import**.
2. Select `HostelHub.postman_collection.json`.
3. The collection is configured with default collection variable `baseUrl = http://localhost:3000`.
4. Run individual requests or use the **Collection Runner** to execute all positive and negative test cases.
