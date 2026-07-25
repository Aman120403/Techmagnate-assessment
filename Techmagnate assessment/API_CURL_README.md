# API Curl Guide — Tech Magnate Assessment

Complete setup + curl reference for **Tech Magnate Assessment** (Express + MongoDB + DataForSEO Live Organic Advanced).

Base URL (local): `http://localhost:5000`

---

## 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | `>= 18` |
| npm | comes with Node |
| MongoDB | running locally (or Atlas URI) |
| Git | for clone |

Check versions:

```bash
node -v
npm -v
mongod --version
```

---

## 2. Clone the project

```bash
git clone <YOUR_REPO_URL>
cd tech-magnate-assessment
```

Example (replace with your real repo):

```bash
git clone https://github.com/<username>/<repo>.git
cd tech-magnate-assessment
```

If you already have the folder:

```bash
cd /path/to/tech-magnate-assessment
```

---

## 3. Install dependencies

```bash
npm install
```

This installs Express, Mongoose, Axios, Multer, csv-parse, etc. (see `package.json`).

---

## 4. Environment setup

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/tech_magnate_assessment

DATAFORSEO_LOGIN=your_login_email
DATAFORSEO_PASSWORD=your_api_password
DATAFORSEO_BASE_URL=https://api.dataforseo.com/v3

# true  = no paid API call (docs-shaped mock) — use for local demo
# false = real DataForSEO Live Advanced (needs real login/password)
DATAFORSEO_MOCK=true

QUEUE_CONCURRENCY=3
MAX_CSV_ROWS=1000
```

**Live QA with real DataForSEO keys:**

1. Get credentials from: https://app.dataforseo.com/api-access  
2. Set `DATAFORSEO_MOCK=false`  
3. Put real `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD`

---

## 5. Start MongoDB

Local Mongo must be running before the app starts.

```bash
# Windows (if installed as service, usually already running)
# Or:
net start MongoDB
```

Mac / Linux (typical):

```bash
sudo systemctl start mongod
# or
brew services start mongodb-community
```

---

## 6. Start the app

**Development (auto-reload):**

```bash
npm run dev
```

**Production-style:**

```bash
npm start
```

Success log looks like:

```text
[INFO] MongoDB connected → tech_magnate_assessment
[INFO] Server listening on http://localhost:5000 [development]
```

Open dashboard UI:

```text
http://localhost:5000
```

---

## 7. API Curls + Expected Responses

> Tip: add `| jq` on Mac/Linux for pretty JSON. On Windows CMD, raw JSON is fine.

---

### 7.1 Health check

**Request**

```bash
curl -s -X GET http://localhost:5000/api/health
```

**Expected response** — `200 OK`

```json
{
  "success": true,
  "message": "ok",
  "ts": "2026-07-25T07:30:00.000Z"
}
```

---

### 7.2 Module 1 — Create single task

`POST /api/tasks`

**Validations**

- `keyword` required  
- `language` required  
- `location` required (numeric location_code, e.g. `2840`)  
- `priority` required, must be `1` or `2`

**Request**

```bash
curl -s -X POST http://localhost:5000/api/tasks ^
  -H "Content-Type: application/json" ^
  -d "{\"keyword\":\"react developer\",\"language\":\"en\",\"location\":2840,\"priority\":1,\"created_by\":\"curl-test\"}"
```

Mac / Linux / Git Bash:

```bash
curl -s -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "react developer",
    "language": "en",
    "location": 2840,
    "priority": 1,
    "created_by": "curl-test"
  }'
```

**Expected response** — `201 Created` (mock mode)

```json
{
  "success": true,
  "message": "Task created",
  "data": {
    "_id": "66a1b2c3d4e5f6789012345",
    "task_id": "mock-1721900000-abc123",
    "status_code": 20000,
    "status_message": "Ok.",
    "cost": 0.003,
    "time": "0.0952 sec.",
    "keyword": "react developer",
    "location_code": 2840,
    "language_code": "en",
    "priority": 1,
    "status": "success",
    "created_by": "curl-test",
    "batch_id": null,
    "error_detail": null,
    "created_at": "2026-07-25T07:31:00.000Z",
    "updated_at": "2026-07-25T07:31:00.000Z"
  }
}
```

**Validation error example** — `422`

```bash
curl -s -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"keyword":"","language":"en","location":2840,"priority":5}'
```

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "keyword", "message": "Keyword is required" },
    { "field": "priority", "message": "Priority must be between 1 and 2" }
  ]
}
```

**What this calls upstream (when `DATAFORSEO_MOCK=false`)**

```http
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
Authorization: Basic <base64(login:password)>
Content-Type: application/json

[
  {
    "keyword": "react developer",
    "location_code": 2840,
    "language_code": "en"
  }
]
```

Stored from DataForSEO `tasks[0]`: `id` → `task_id`, `status_code`, `status_message`, `cost`, `time`.

---

### 7.3 Module 2 — Bulk CSV upload

`POST /api/tasks/bulk`  
Multipart field name: **`file`**

**Sample CSV** (in repo): `samples/tasks-sample.csv`

Format:

```csv
keyword,language,location,priority
react developer,en,2840,1
seo tools,en,2840,2
digital marketing,en,2840,1
```

**Request (Windows)**

```bash
curl -s -X POST http://localhost:5000/api/tasks/bulk ^
  -F "file=@./samples/tasks-sample.csv"
```

**Request (Mac / Linux)**

```bash
curl -s -X POST http://localhost:5000/api/tasks/bulk \
  -F "file=@./samples/tasks-sample.csv"
```

**Expected response** — `202 Accepted` (all rows valid)

```json
{
  "success": true,
  "message": "5 tasks queued for processing",
  "data": {
    "total_rows": 5,
    "valid_count": 5,
    "invalid_count": 0,
    "invalid_rows": [],
    "queue": {
      "batch_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "total_tasks": 5,
      "total_batches": 1,
      "batch_sizes": [5]
    },
    "task_ids": [
      "66a1b2c3d4e5f6789012345",
      "66a1b2c3d4e5f6789012346"
    ]
  }
}
```

**Partial success** — `207` (some invalid rows)

```json
{
  "success": true,
  "message": "3 tasks queued, 2 rows rejected",
  "data": {
    "total_rows": 5,
    "valid_count": 3,
    "invalid_count": 2,
    "invalid_rows": [
      {
        "row": 4,
        "data": {
          "keyword": "",
          "language": "en",
          "location": "2840",
          "priority": "1"
        },
        "errors": ["Keyword is required"]
      }
    ],
    "queue": {
      "batch_id": "...",
      "total_tasks": 3,
      "total_batches": 1,
      "batch_sizes": [3]
    },
    "task_ids": ["..."]
  }
}
```

**All invalid** — `422`

```json
{
  "success": true,
  "message": "All rows failed validation — nothing queued",
  "data": {
    "total_rows": 1,
    "valid_count": 0,
    "invalid_count": 1,
    "invalid_rows": [
      {
        "row": 2,
        "data": {
          "keyword": "",
          "language": "",
          "location": "",
          "priority": ""
        },
        "errors": [
          "Keyword is required",
          "Language is required",
          "Location is required",
          "Priority is required"
        ]
      }
    ],
    "queue": null,
    "task_ids": []
  }
}
```

**Batching rule**

| Tasks | Batches |
|------:|---------|
| 100 | 1 × 100 |
| 250 | 100 + 100 + 50 |
| 5 | 1 × 5 |

Max **100 tasks per batch**. Live Advanced = **1 HTTP call per task** inside the queue.

---

### 7.4 Queue status

**Request**

```bash
curl -s -X GET http://localhost:5000/api/tasks/queue/status
```

**Expected response** — `200 OK`

```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 0,
    "enqueued": 1,
    "completed": 1,
    "failed": 0,
    "concurrency": 3
  }
}
```

While bulk is processing you may see `waiting` / `active` > 0.

---

### 7.5 Module 3 — Dashboard list (server-side pagination)

`GET /api/dashboard/tasks`

**Query params**

| Param | Example | Description |
|--------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Rows per page (max 100) |
| `search` | `react` | Keyword / task_id / language |
| `status` | `success` | `queued`, `processing`, `success`, `failed` |
| `priority` | `1` | `1` or `2` |
| `language` | `en` | Language code |
| `location` | `2840` | Location code |
| `sortBy` | `created_at` | Sortable field |
| `sortOrder` | `desc` | `asc` or `desc` |
| `columns` | `task_id,keyword,status` | Column projection |

**Basic list**

```bash
curl -s "http://localhost:5000/api/dashboard/tasks?page=1&limit=20&sortBy=created_at&sortOrder=desc"
```

**Expected response** — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1b2c3d4e5f6789012345",
      "task_id": "mock-1721900000-abc123",
      "keyword": "react developer",
      "language_code": "en",
      "location_code": 2840,
      "priority": 1,
      "status": "success",
      "status_code": 20000,
      "status_message": "Ok.",
      "cost": 0.003,
      "time": "0.0952 sec.",
      "created_by": "curl-test",
      "created_at": "2026-07-25T07:31:00.000Z",
      "updated_at": "2026-07-25T07:31:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

**Search**

```bash
curl -s "http://localhost:5000/api/dashboard/tasks?page=1&limit=10&search=react"
```

**Filter + sort + columns**

```bash
curl -s "http://localhost:5000/api/dashboard/tasks?page=1&limit=10&status=success&priority=1&language=en&location=2840&sortBy=keyword&sortOrder=asc&columns=task_id,keyword,language_code,location_code,priority,status,cost,created_at"
```

---

### 7.6 Get single task by Mongo `_id`

```bash
curl -s http://localhost:5000/api/dashboard/tasks/66a1b2c3d4e5f6789012345
```

**Expected** — `200 OK`

```json
{
  "success": true,
  "data": {
    "_id": "66a1b2c3d4e5f6789012345",
    "task_id": "mock-1721900000-abc123",
    "keyword": "react developer",
    "status": "success"
  }
}
```

**Not found** — `404`

```json
{
  "success": false,
  "message": "Task not found"
}
```

---

## 8. Full test flow (copy-paste order)

```bash
# 1) Health
curl -s http://localhost:5000/api/health

# 2) Single create
curl -s -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"keyword":"react developer","language":"en","location":2840,"priority":1,"created_by":"demo"}'

# 3) Bulk upload
curl -s -X POST http://localhost:5000/api/tasks/bulk \
  -F "file=@./samples/tasks-sample.csv"

# 4) Queue
curl -s http://localhost:5000/api/tasks/queue/status

# 5) Dashboard
curl -s "http://localhost:5000/api/dashboard/tasks?page=1&limit=20&sortBy=created_at&sortOrder=desc"
```

---

## 9. Status codes cheat sheet

| HTTP | When |
|------|------|
| `200` | Health, dashboard, queue status |
| `201` | Single task created |
| `202` | Bulk accepted (all valid, queued) |
| `207` | Bulk partial (valid queued + invalid listed) |
| `400` | Bad CSV / missing file |
| `404` | Route or task not found |
| `422` | Validation failed / all CSV rows invalid |
| `500` / `502` | Server / DataForSEO upstream error |

---

## 10. Dashboard UI columns

| Column | Field |
|--------|--------|
| Task ID | `task_id` |
| Keyword | `keyword` |
| Language | `language_code` |
| Location | `location_code` |
| Priority | `priority` |
| Status | `status` |
| Cost | `cost` |
| Created Date | `created_at` |

Features: pagination, search, sorting, filtering, column visibility toggle — all server-side via `/api/dashboard/tasks`.

---

## 11. Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoDB connection error` | Start MongoDB; check `MONGODB_URI` |
| Bulk: all fields empty | Use `samples/tasks-sample.csv`; headers must be `keyword,language,location,priority` |
| `DataForSEO credentials missing` | Set real keys **or** keep `DATAFORSEO_MOCK=true` |
| Port in use | Change `PORT` in `.env` |
| `curl` not found (Windows) | Use Windows 10+ built-in curl, or Git Bash |

---

## 12. Project scripts

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start with nodemon |
| `npm start` | Start with node |

---

**Docs reference:** [DataForSEO Live Google Organic Advanced](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/)
