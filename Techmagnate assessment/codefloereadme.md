# Code Flow Documentation

**Project:** Tech Magnate Assessment — DataForSEO SERP Pipeline  
**Stack:** Express.js · MongoDB/Mongoose · In-process queue · Static dashboard  
**Audience:** Engineering / Team Lead review  
**Architecture style:** MVC — `routes → controllers → services → models`

This document explains **why each file exists**, **how a request moves through the codebase**, and **how DataForSEO is called** at the code level.

---

## 1. High-level architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────┐
│   Client    │────▶│   Routes     │────▶│  Controllers   │────▶│  Services   │
│ (API / UI)  │     │  + validators │     │  (HTTP layer)  │     │ (business)  │
└─────────────┘     └──────────────┘     └────────────────┘     └──────┬──────┘
                                                                       │
                         ┌─────────────────────────────────────────────┼──────────────┐
                         ▼                                             ▼              ▼
                  ┌─────────────┐                              ┌──────────────┐  ┌────────────┐
                  │ Task Queue  │──processQueuedTask───────────▶│ DataForSEO   │  │  MongoDB   │
                  │ (in-memory) │                              │   Service    │  │  (Task)    │
                  └─────────────┘                              └──────────────┘  └────────────┘
```

**Layer responsibilities**

| Layer | Responsibility |
|--------|----------------|
| **Routes** | URL mapping, middleware chain (validation, upload) |
| **Controllers** | Parse HTTP input, call services, shape JSON responses |
| **Services** | Business rules, external API, DB writes, queue enqueue |
| **Models** | Schema, indexes, persistence |
| **Queue** | Async bulk processing with concurrency control |
| **Utils / Middleware** | Cross-cutting concerns (errors, logging, uploads) |

---

## 2. Application bootstrap (startup flow)

### Order of execution

```
server.js
  │
  ├─ 1. require('dotenv').config()          → load .env
  ├─ 2. require('./src/app')                → build Express app
  ├─ 3. connectDB()                         → MongoDB via mongoose
  └─ 4. app.listen(env.port)                → HTTP server ready
       + SIGINT / SIGTERM graceful shutdown
```

### Files involved at boot

| File | Purpose |
|------|---------|
| `server.js` | **Process entry point.** Loads env, connects DB, starts HTTP listener, handles graceful shutdown. Does not define routes — that stays in `app.js`. |
| `src/app.js` | **Express app factory.** Registers security middleware (helmet, cors), body parsers, static `public/`, API routes under `/api`, 404 + error handlers. Also wires the queue processor to `taskService.processQueuedTask` to avoid a circular require between queue ↔ service. |
| `src/config/env.js` | **Central env access.** Reads `PORT`, `MONGODB_URI`, DataForSEO credentials, `DATAFORSEO_MOCK`, `QUEUE_CONCURRENCY`, `MAX_CSV_ROWS`. In production (non-mock) fails fast if secrets are missing. |
| `src/config/db.js` | **MongoDB connection.** Single `connectDB()` used at startup; logs connection name and listens for connection errors. |
| `src/config/constants.js` | **Shared constants.** Batch size (100), priority range (1–2), task lifecycle statuses, sortable fields, pagination defaults. One place to change behaviour without hunting magic numbers. |

---

## 3. File-by-file purpose (full map)

### Entry & app shell

| Path | Why it exists |
|------|----------------|
| `server.js` | Start the Node process; keep boot logic separate from Express wiring. |
| `src/app.js` | Compose middleware + routes; export `app` for testability and clean separation from listen/shutdown. |
| `package.json` | Dependencies and scripts (`start`, `dev`). |

### Config

| Path | Why it exists |
|------|----------------|
| `src/config/env.js` | Typed, frozen config object so services do not read `process.env` ad hoc. |
| `src/config/db.js` | Isolate mongoose connect/retry concerns from business code. |
| `src/config/constants.js` | Domain limits and enums shared by model, queue, validators, dashboard. |

### Routes

| Path | Why it exists |
|------|----------------|
| `src/routes/index.js` | Mounts `/health`, `/tasks`, `/dashboard` under `/api`. Single API root. |
| `src/routes/taskRoutes.js` | Module 1 & 2: `POST /`, `POST /bulk`, `GET /queue/status`. Attaches validators and multer. |
| `src/routes/dashboardRoutes.js` | Module 3: `GET /tasks`, `GET /tasks/:id`. |

### Controllers

| Path | Why it exists |
|------|----------------|
| `src/controllers/taskController.js` | Thin HTTP handlers for single create, bulk CSV, queue status. Normalises aliases (`language` vs `language_code`), returns HTTP 201 / 202 / 207 / 422 appropriately. |
| `src/controllers/dashboardController.js` | Passes query string to dashboard service; returns `data` + `pagination`. |

### Services

| Path | Why it exists |
|------|----------------|
| `src/services/taskService.js` | Core task lifecycle: immediate create (single), bulk insert + enqueue, queue worker that updates Mongo after each Live API call. |
| `src/services/dataForSeoService.js` | **Only place that talks to DataForSEO.** Builds request body, Basic Auth, maps `tasks[0]` into our persistence shape, supports mock mode. |
| `src/services/csvService.js` | Parse CSV buffer, validate headers/rows, split valid vs invalid without touching the DB. |
| `src/services/dashboardService.js` | Server-side filter, search, sort, pagination, column projection for the UI. |

### Model & queue

| Path | Why it exists |
|------|----------------|
| `src/models/Task.js` | Mongoose schema for SERP tasks + internal `status` / `batch_id` / `raw_response`. Indexes for dashboard queries. |
| `src/queues/taskQueue.js` | In-memory FIFO queue with concurrency. Processes batches; each task still = one Live HTTP call. Chosen over Redis/Bull to keep assessment stack lean. |

### Validation & middleware

| Path | Why it exists |
|------|----------------|
| `src/validators/taskValidator.js` | Shared validation for JSON API and CSV rows (`validateTaskPayload`) so both paths accept the same rules. Express-validator chain for `POST /api/tasks`. |
| `src/middleware/upload.js` | Multer memory storage for CSV (≤2 MB); rejects non-CSV. |
| `src/middleware/errorHandler.js` | Central JSON error responses for `ApiError`, Multer, Mongoose cast/validation, and unexpected 500s. `notFound` for unknown routes. |

### Utils & fixtures

| Path | Why it exists |
|------|----------------|
| `src/utils/ApiError.js` | Operational errors with `statusCode` + optional `details` (vs programmer bugs). |
| `src/utils/asyncHandler.js` | Forwards async controller rejections to `next(err)` without try/catch in every handler. |
| `src/utils/batch.js` | `chunkArray` — splits N tasks into batches of 100 (e.g. 250 → 100/100/50). |
| `src/utils/logger.js` | Timestamped console logger; swap-friendly wrapper for later winston/pino. |
| `src/fixtures/mockLiveResponse.js` | Docs-shaped DataForSEO response when `DATAFORSEO_MOCK=true` (local/demo without paid keys). |

### Frontend (dashboard)

| Path | Why it exists |
|------|----------------|
| `public/index.html` | Static dashboard shell (forms, table, filters). |
| `public/css/dashboard.css` | Dashboard styles. |
| `public/js/dashboard.js` | Client state + fetch to `/api/dashboard/tasks`, create/bulk endpoints, column toggle, pagination, queue badge. |

---

## 4. API code flows (step-by-step)

### 4.1 Module 1 — Single task create (synchronous)

**Endpoint:** `POST /api/tasks`  
**Behaviour:** Call DataForSEO Live Advanced immediately, then save the result to MongoDB. Client waits for the final document.

```
Client
  │  JSON: { keyword, language, location, priority, created_by? }
  ▼
taskRoutes.js
  │  singleTaskRules → handleValidation
  ▼
taskController.createSingle
  │  validateTaskPayload (normalise language/location aliases)
  │  created_by = body | x-user header | "api"
  ▼
taskService.createSingle(input, createdBy)
  │
  ├─▶ dataForSeoService.createLiveOrganicTask(input)
  │     │
  │     ├─ #buildRequestItem → { keyword, language_code, location_code }
  │     │   (priority is NOT sent to Live Advanced — app-only field)
  │     ├─ body = [ requestItem ]   ← vendor rule: 1 task per HTTP call
  │     │
  │     ├─ if DATAFORSEO_MOCK=true
  │     │     return map(mock fixture)
  │     └─ else
  │           axios POST /serp/google/organic/live/advanced
  │           Basic Auth (login, password)
  │           map tasks[0] → { task_id, status_code, cost, time, raw_response, ... }
  │
  └─▶ Task.create({ ...mapped, status: success|failed, created_by })
        │
        ▼
      HTTP 201 { success, data: taskDocument }
```

**Key files in this path**

1. `src/routes/taskRoutes.js` — binds middleware + controller  
2. `src/validators/taskValidator.js` — express-validator + shared normaliser  
3. `src/controllers/taskController.js` — `createSingle`  
4. `src/services/taskService.js` — `createSingle`  
5. `src/services/dataForSeoService.js` — Live API client  
6. `src/models/Task.js` — persistence  

**Status mapping**

- DataForSEO `tasks[0].status_code === 20000` → app `status: "success"`  
- Otherwise → app `status: "failed"`

---

### 4.2 Module 2 — Bulk CSV upload (asynchronous)

**Endpoint:** `POST /api/tasks/bulk` (multipart field: `file`)  
**Behaviour:** Validate CSV → insert valid rows as `queued` → split into batches of 100 → enqueue → return immediately. Workers process in the background.

```
Client (multipart/form-data, field "file")
  ▼
taskRoutes.js
  │  upload.single('file')   ← middleware/upload.js (memory buffer)
  ▼
taskController.createBulk
  │
  ├─ parseAndValidateCsv(req.file.buffer)   ← csvService.js
  │     • detect delimiter (, or ;)
  │     • require headers: keyword, language, location, priority
  │     • enforce MAX_CSV_ROWS
  │     • per-row validateTaskPayload → { valid[], invalid[] }
  │
  └─ if valid.length
        taskService.enqueueBulk(valid, createdBy)
          │
          ├─ batch_id = randomUUID()
          ├─ Task.insertMany(docs with status=queued, batch_id)
          ├─ chunkArray(inserted, 100)     ← utils/batch.js
          └─ for each chunk:
                taskQueue.enqueue({
                  batchId, batchIndex, totalBatches, taskIds[]
                })
  ▼
HTTP 202 / 207 / 422
  {
    total_rows, valid_count, invalid_count,
    invalid_rows, queue: { batch_id, total_batches, ... }, task_ids
  }
```

**HTTP status choices (controller)**

| Situation | Status |
|-----------|--------|
| All rows valid | `202 Accepted` (queued async) |
| Mix of valid + invalid | `207` (partial success) |
| All rows invalid | `422` (nothing queued) |

#### Background processing (after response is sent)

```
taskQueue.#pump()
  │  while active < QUEUE_CONCURRENCY and jobs waiting:
  │    take next job (one batch)
  ▼
taskQueue.#run(job)
  │  for each taskId in job.taskIds (sequential inside batch):
  │    await processor(taskId)
  ▼
taskService.processQueuedTask(taskId)   ← wired in app.js
  │
  ├─ Task.findById → status = "processing"
  ├─ dataForSeoService.createLiveOrganicTask(...)
  ├─ update task fields (task_id, cost, time, raw_response, ...)
  ├─ status = success | failed
  └─ on exception: status=failed, store error_detail; do NOT rethrow
       (one bad row must not kill the rest of the batch)
```

**Queue design notes**

- Outer concurrency (`QUEUE_CONCURRENCY`, default 3) = how many **batches** run in parallel.  
- Inside a batch, tasks run **one-by-one** because Live Advanced allows **1 task per HTTP request**.  
- Queue is **in-process** (lost on restart). Acceptable for this assessment; production would use Redis/Bull.

**Queue status endpoint:** `GET /api/tasks/queue/status` → `taskQueue.getStatus()` (`waiting`, `active`, `enqueued`, `completed`, `failed`, `concurrency`).

---

### 4.3 Module 3 — Dashboard list / detail

**Endpoints**

- `GET /api/dashboard/tasks?...`  
- `GET /api/dashboard/tasks/:id`

```
Browser (public/js/dashboard.js)
  │  builds query: page, limit, search, status, priority,
  │                language, location, sortBy, sortOrder, columns
  ▼
dashboardRoutes.js
  ▼
dashboardController.listTasks / getTask
  ▼
dashboardService.listTasks(query)
  │
  ├─ #buildFilter  (regex search on keyword/task_id/language; exact filters)
  ├─ #buildSort    (whitelist SORTABLE_FIELDS)
  ├─ #buildProjection (optional column subset; always keep _id)
  └─ Promise.all([
       Task.find(...).sort().skip().limit().lean(),
       Task.countDocuments(filter)
     ])
  ▼
{ data: items, pagination: { page, limit, total, totalPages, hasNext, hasPrev } }
```

**Frontend role:** `public/js/dashboard.js` owns UI state, debounced search, column visibility, create/bulk dialogs, and a queue badge that polls `/api/tasks/queue/status`.

---

## 5. DataForSEO integration (code-level contract)

**File:** `src/services/dataForSeoService.js`  
**Docs:** [Live Organic Advanced](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/)

| Item | Value |
|------|--------|
| Method | `POST` |
| Path | `/serp/google/organic/live/advanced` |
| Base URL | `https://api.dataforseo.com/v3` (overridable) |
| Auth | HTTP Basic (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`) |
| Body | Array with **exactly one** object |
| Timeout | 120 seconds |

**Request we send**

```json
[
  {
    "keyword": "albert einstein",
    "location_code": 2840,
    "language_code": "en"
  }
]
```

**Important:** App-level `priority` (1 or 2) is stored in Mongo only. It is **not** included in the Live Advanced payload (priority belongs to the Task POST API family, not this endpoint).

**Response fields we persist** (from `tasks[0]`)

| Mongo field | Source |
|-------------|--------|
| `task_id` | `tasks[0].id` |
| `status_code` | `tasks[0].status_code` |
| `status_message` | `tasks[0].status_message` |
| `cost` | `tasks[0].cost` |
| `time` | `tasks[0].time` |
| `keyword` / `location_code` / `language_code` / `priority` | Our request |
| `raw_response` | Full API JSON (`select: false` by default) |

**Mock mode:** `DATAFORSEO_MOCK=true` → `src/fixtures/mockLiveResponse.js` returns a docs-shaped payload; no network call.

---

## 6. Task document lifecycle

```
                    ┌─────────────┐
   bulk insert ───▶ │   queued    │
                    └──────┬──────┘
                           │ processQueuedTask starts
                           ▼
                    ┌─────────────┐
                    │ processing  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐           ┌─────────────┐
       │   success   │           │   failed    │
       └─────────────┘           └─────────────┘

Single create path skips "queued/processing" and writes success|failed in one step.
```

Constants live in `src/config/constants.js` → `TASK_STATUS`.

---

## 7. Cross-cutting error flow

```
Any throw / rejected promise in asyncHandler-wrapped controller
  ▼
next(err)
  ▼
middleware/errorHandler.js
  ├─ MulterError          → 400
  ├─ ApiError             → err.statusCode + message + details
  ├─ CastError            → 400
  ├─ ValidationError      → 422
  └─ unknown              → 500 (hide message in production)
```

`ApiError` marks intentional failures (`isOperational = true`) so the handler can distinguish them from unexpected crashes.

---

## 8. Request routing cheat sheet

| Method | Path | Controller | Service | Sync/Async |
|--------|------|------------|---------|------------|
| `GET` | `/api/health` | inline in routes | — | Sync |
| `POST` | `/api/tasks` | `createSingle` | `taskService.createSingle` → DataForSEO | Sync |
| `POST` | `/api/tasks/bulk` | `createBulk` | csv + `enqueueBulk` + queue | Async (202) |
| `GET` | `/api/tasks/queue/status` | `queueStatus` | `taskQueue.getStatus` | Sync |
| `GET` | `/api/dashboard/tasks` | `listTasks` | `dashboardService.listTasks` | Sync |
| `GET` | `/api/dashboard/tasks/:id` | `getTask` | `dashboardService.getById` | Sync |
| `GET` | `/` (static) | — | `public/` | Sync |

---

## 9. Circular dependency avoidance

`taskQueue` needs a processor from `taskService`, and `taskService` needs `taskQueue` to enqueue bulk jobs.

**Solution (in `src/app.js`):**

```js
taskQueue.setProcessor((taskId) => taskService.processQueuedTask(taskId));
```

Both modules load without calling each other at require-time; the processor is injected after both exist.

---

## 10. Design decisions (for review)

1. **MVC layering** — Controllers stay thin; services own business logic and external I/O.  
2. **One DataForSEO client** — All vendor HTTP lives in `dataForSeoService.js` for easier mocking and credential handling.  
3. **Shared validators** — JSON and CSV use the same `validateTaskPayload` to avoid rule drift.  
4. **Batch = queue work unit; Live call = still 1 task** — Batches of 100 organise work; vendor Live Advanced still requires one HTTP call per keyword.  
5. **In-process queue** — Deliberately simple for the assessment; documented as replaceable with Redis/Bull later.  
6. **Mock fixture** — Enables full demo without paid API keys (`DATAFORSEO_MOCK=true`).  
7. **Server-side dashboard queries** — Filtering/sort/pagination happen in Mongo, not in the browser, so large datasets stay manageable.

---

## 11. Suggested reading order for new developers

1. `server.js` → `src/app.js` → `src/routes/index.js`  
2. `src/models/Task.js` + `src/config/constants.js`  
3. Module 1 path: `taskRoutes` → `taskController` → `taskService` → `dataForSeoService`  
4. Module 2 path: `upload` → `csvService` → `enqueueBulk` → `taskQueue` → `processQueuedTask`  
5. Module 3 path: `dashboardRoutes` → `dashboardService` → `public/js/dashboard.js`  

---

*Document generated for team / lead review. For API examples and curl samples, see `README.md` and `API_CURL_README.md`.*
