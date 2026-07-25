# Tech Magnate Assessment — DataForSEO Pipeline

Tech Magnate Assessment project: Express + MongoDB app for creating SERP tasks (single + CSV bulk), queue-based processing against DataForSEO Live Organic Advanced, and a server-side paginated dashboard.

## Stack

- **Express** — MVC (`routes → controllers → services → models`)
- **MongoDB / Mongoose** — task persistence
- **In-process queue** — batches of 100, concurrency via `QUEUE_CONCURRENCY`
- **Static dashboard** — `public/` (search, sort, filter, column toggle)

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).

### Credentials (for QA / live testing)

You do **not** need paid keys to run the app locally. Default:

```env
DATAFORSEO_MOCK=true
```

That returns a docs-shaped fixture (no HTTP call).

For real Live API calls, set:

```env
DATAFORSEO_MOCK=false
DATAFORSEO_LOGIN=<from https://app.dataforseo.com/api-access>
DATAFORSEO_PASSWORD=<API password from same page>
```

Integration code lives in `src/services/dataForSeoService.js`.

---

## DataForSEO integration (Live Advanced)

Docs: [serp/google/organic/live/advanced](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/)

| | |
|---|---|
| Method | `POST` |
| URL | `https://api.dataforseo.com/v3/serp/google/organic/live/advanced` |
| Auth | HTTP Basic (`login` + `password`) |
| Limit | **1 task per request** (vendor rule) |

### Request we send

```json
[
  {
    "keyword": "albert einstein",
    "location_code": 2840,
    "language_code": "en"
  }
]
```

Notes:

- `keyword`, `location_code`, `language_code` match the official docs.
- App-level `priority` (1|2) is stored in Mongo only — **not** sent on Live Advanced (priority belongs to Task POST, not this endpoint).

### Response we read

Top-level + `tasks[0]` (docs sample abbreviated):

```json
{
  "version": "0.1.20200129",
  "status_code": 20000,
  "status_message": "Ok.",
  "time": "0.3059 sec.",
  "cost": 0.003,
  "tasks_count": 1,
  "tasks_error": 0,
  "tasks": [
    {
      "id": "11151456-0696-0066-0000-002a5915da37",
      "status_code": 20000,
      "status_message": "Ok.",
      "time": "0.0952 sec.",
      "cost": 0.003,
      "result_count": 1,
      "result": [ /* SERP items… */ ]
    }
  ]
}
```

### Fields stored in Mongo

| Field | Source |
|--------|--------|
| `task_id` | `tasks[0].id` |
| `status_code` | `tasks[0].status_code` |
| `status_message` | `tasks[0].status_message` |
| `cost` | `tasks[0].cost` |
| `time` | `tasks[0].time` |
| `keyword` | our request |
| `location_code` | our request |
| `language_code` | our request |
| `priority` | our request (app only) |
| `created_by` / `created_at` | app |

Full raw payload is kept on `raw_response` (hidden from default queries).

---

## App API

### Module 1 — Single task

`POST /api/tasks`

```json
{
  "keyword": "react developer",
  "language": "en",
  "location": 2840,
  "priority": 1,
  "created_by": "qa-user"
}
```

### Module 2 — Bulk CSV

`POST /api/tasks/bulk` — multipart field `file`

```csv
keyword,language,location,priority
react developer,en,2840,1
seo tools,en,2840,2
```

- Validates each row; returns `invalid_rows`
- Queues only valid rows
- Splits into batches of **100** (250 → 100 / 100 / 50)
- Each queued item still hits Live Advanced as **1 HTTP call** (docs constraint)

`GET /api/tasks/queue/status`

### Module 3 — Dashboard

`GET /api/dashboard/tasks?page=1&limit=20&search=&status=&priority=&language=&location=&sortBy=created_at&sortOrder=desc&columns=...`

Server-side pagination, search, sort, filter, column projection.

---

## Project layout

```
server.js
src/
  app.js
  config/
  models/
  controllers/
  services/          # dataForSeoService = official live/advanced client
  fixtures/          # mock response (docs shape)
  queues/
  validators/
  middleware/
  routes/
public/
samples/tasks-sample.csv
```
