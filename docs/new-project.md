# Project Specification: Market Validator

## 1. Executive Summary

Market Validator is an automated market research tool designed to identify, analyze, and validate business opportunities ("pain points") from Reddit discussions.

Instead of simple keyword monitoring, the system acts as an intelligent analyst:

- Ingests discussions from broad industry subreddits.
- Filters noise using heuristic patterns.
- Analyzes content using LLMs to identify unmet needs and proposed solutions.
- Groups similar ideas using vector embeddings to quantify demand.
- Presents a dashboard of validated opportunities sorted by market interest.

## 2. Technology Stack

- **Framework:** Nuxt 4 (Full-stack: Vue 3 SSR + Nitro Server Engine)
- **Styling:** Tailwind CSS v4
- **Database:** SQLite (at db/db.db, managed with server/lib/sqlite.js, queried with server/lib/sqlite-helpers.js)
- **Driver:** better-sqlite3
- **Vector Extension:** sqlite-vec (semantic search and clustering)
- **Authentication:** nuxt-auth-utils
- **Strategy:** Email & Password (custom implementation with session management)
- **Hashing:** Node.js native scrypt or bcrypt
- **AI/ML:** OpenAI API
  - **Analysis:** gpt-5-nano (cost-effective classification)
  - **Embeddings:** text-embedding-3-small (vector generation)
- **Scheduling:** Nitro Server Tasks (CRON jobs)

## 3. System Architecture & Data Flow

The backend operates a continuous analysis loop.

### Phase 1: Ingestion

- **Source:** Reddit RSS feeds
- **Target:** Broad communities (e.g., r/SaaS, r/marketing, r/smallbusiness, r/startups)
- **Frequency:** Poll every 10–30 minutes via scheduled tasks

### Phase 2: Heuristic Filtration (The Gatekeeper)

- **Objective:** Minimize AI costs by discarding irrelevant posts before API calls.
- **Mechanism:** Regex pattern matching for "pain signals".
- **Signals:**
  - "how to"
  - "struggling with"
  - "hate doing"
  - "alternative to"
  - "too expensive"
  - "wish there was"

### Phase 3: AI Analysis & Extraction

- **Input:** Post title + body
- **Process:** Send to gpt-5-nano
- **Output:** JSON structure containing:
  - `is_opportunity`: Boolean
  - `pain_point_summary`: String (e.g., "Invoicing takes too long")
  - `proposed_solution`: String (e.g., "AI-based PDF parser")
- **Vectorization:** If `is_opportunity` is true, generate an embedding vector for `pain_point_summary` using text-embedding-3-small.

### Phase 4: Semantic Clustering (Deduplication)

- **Objective:** Group "I hate invoicing" and "Billing is slow" into a single opportunity.
- **Mechanism:** Query sqlite-vec for existing ideas with a cosine distance `< 0.15` (threshold).
- **Action:**
  - **Match Found:** Increment `post_count` on the existing cluster; link the new post to it.
  - **No Match:** Create a new opportunity cluster and store its vector.

## 4. Database Schema

The database uses standard relational tables alongside a virtual vector table.

### 4.1. `users`

Stores authentication credentials.

| Column        | Type    | Notes                 |
| ------------- | ------- | --------------------- |
| ID            | TEXT    | Primary Key, UUID     |
| email         | TEXT    | Unique, Indexed       |
| password_hash | TEXT    | Scrypt/Bcrypt hash    |
| username      | TEXT    | Optional display name |
| created_at    | INTEGER | Unix timestamp        |

### 4.2. `opportunity_clusters`

Represents a unique business idea or pain point found in the market.

| Column        | Type    | Notes                                      |
| ------------- | ------- | ------------------------------------------ |
| ID            | TEXT    | Primary Key, UUID                          |
| title         | TEXT    | Short summary (e.g., "Invoice Automation") |
| description   | TEXT    | AI-generated problem definition            |
| solution_idea | TEXT    | AI-generated potential solution            |
| post_count    | INTEGER | Key Metric: number of validating posts     |
| status        | TEXT    | 'new', 'investigating', 'archived'         |
| last_seen_at  | INTEGER | Unix timestamp (for recency sorting)       |
| created_at    | INTEGER | Unix timestamp                             |

### 4.3. `analyzed_posts`

Raw evidence. Stores the Reddit posts that validated an opportunity.

| Column     | Type    | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| ID         | TEXT    | Primary Key (Reddit ID, e.g., t3_xyz) |
| cluster_id | INTEGER | Foreign Key → opportunity_clusters.id |
| subreddit  | TEXT    | Source community                      |
| title      | TEXT    | Original post title                   |
| body       | TEXT    | Original post body                    |
| url        | TEXT    | Permalink to Reddit                   |
| created_at | INTEGER | Unix timestamp                        |

### 4.4. `vec_opportunities`

Virtual table managed by sqlite-vec. Docs: https://github.com/asg017/sqlite-vec

| Column    | Type        | Notes                                 |
| --------- | ----------- | ------------------------------------- |
| rowid     | INTEGER     | Foreign Key → opportunity_clusters.id |
| embedding | FLOAT[1536] | Vector data                           |

## 5. Backend Implementation Details (Server-Side)

### 5.1. Database Initialization (server/utils/db.js)

Must initialize better-sqlite3 and load the sqlite-vec extension immediately.

file: server/lib/sqlite.js

### 5.2. Authentication (server/api/auth/login.post.js)

- **Input:** `{ email, password }`
- **Logic:**
  - Fetch user by email.
  - Verify password hash (using scrypt or bcrypt).
  - If valid, use `setUserSession` (from nuxt-auth-utils) to set the cookie.
  - Return user profile (excluding hash).

### 5.3. AI Logic (server/utils/ai.js)

- `analyzePost(title, body)`
  - **System Prompt:** "You are a Product Manager. Analyze this post. Does it express a clear pain point or business need? Return JSON."
- `getEmbedding(text)`
  - Call OpenAI embeddings endpoint.
  - Return `number[]`.

### 5.4. Clustering Engine (server/utils/clustering.js)

Query logic:

```sql
SELECT rowid, distance
FROM vec_opportunities
WHERE embedding MATCH ?
	AND k = 1
ORDER BY distance
LIMIT 1;
```

Threshold: `0.15` (adjust based on testing; lower = stricter matching).

## 6. Frontend Specification

### 6.1. Authentication

- **Page:** `/login`
- **Features:** Email/Password form
- **Action:** POST to `/api/auth/login`, then redirect to `/` on success.

### 6.2. Dashboard (Home)

- **Page:** `/` (protected)
- **Layout:** Grid of "Opportunity Cards"
- **Sorting:**
  - High Demand: `post_count` DESC
  - Fresh: `last_seen_at` DESC
- **Card Content:** Title, short description, "Signal Strength" (post count), badge for subreddit sources.

### 6.3. Opportunity Detail

- **Page:** `/opportunity/[id]`
- **Content:**
  - Problem statement (full AI description)
  - Proposed solution (AI suggestion)
  - Evidence locker: list of `analyzed_posts` related to this cluster
  - Each item shows the Reddit snippet and a link to the original thread.

### 6.4. Settings

- **Page:** `/settings`
- **Config:**
  - Manage subreddit list
  - Manage heuristic keywords (regex strings)

## 7. Implementation Roadmap

### Phase 1: Foundation

- Setup Nuxt 4 + Tailwind 4.
- Implement sqlite + sqlite-vec connection.
- Implement user migration & seed script.
- Implement auth (login/logout/session).

### Phase 2: The Engine

- Create ingest task (RSS fetcher).
- Implement heuristic filter.
- Integrate OpenAI (analyze + embed).
- Implement clustering logic (read/write `vec_opportunities`).

### Phase 3: The UI

- Build dashboard (cards & sorting).
- Build detail view (evidence list).
- Refine UI/UX (loading states, empty states).

## 8. Development Notes

- **Cost Safety:** The heuristic filter is mandatory. Do not pipe raw RSS feeds directly to OpenAI.
- **Error Handling:** Reddit RSS often returns 429 (Too Many Requests). Implement robust retry logic with exponential backoff in the ingestion task.
- **Type Safety:** Use Zod for runtime validation of AI JSON responses.
