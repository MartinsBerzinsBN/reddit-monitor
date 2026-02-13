# Reddit Monitor — How It Works

## High-level summary

Reddit Monitor is a Node.js service that continuously polls Reddit RSS feeds for a set of configured profiles, scans each post for keyword matches, persists results in SQLite to dedupe alerts, and sends matching posts to a Discord webhook. It also exposes a lightweight HTTP health endpoint.

## Architecture overview

- **Entry point:** `index.js`
- **Config + validation:** `src/config.js`
- **Profile definitions:** `src/tasks.js`
- **RSS fetching + normalization:** `src/rss.js`
- **Keyword matching:** `src/keywords.js`
- **Persistence + retention:** `src/db.js`
- **Discord alerts:** `src/discord.js`
- **Defaults:** `src/constants.js`

The service runs a single polling loop. Each poll:

1. Fetches RSS for every profile.
2. Normalizes RSS items into posts.
3. Matches keywords against title/body.
4. Writes new posts to SQLite.
5. Sends Discord alerts for new matches.
6. Purges old rows based on retention.

## Detailed flow

### 1) Boot and runtime lifecycle

On startup, the service:

- Loads configuration using `loadConfig()`.
- Initializes SQLite (schema + prepared statements).
- Starts an Express server with `GET /up` for health checks.
- Starts the polling loop.

The poller is self-scheduling: after each run it waits `pollIntervalSeconds` and runs again. A guard flag prevents overlapping runs.

### 2) Configuration and profiles

Profiles are defined in `src/tasks.js`. Each profile includes:

- **ID** and optional **NAME**
- **SUBREDDITS** list
- **KEYWORDS** list

At startup, `loadConfig()`:

- Normalizes keywords (lowercase, trimmed, de-duplicated).
- Builds a Reddit RSS URL for each profile using its subreddits.
- Validates that profile IDs are unique.
- Ensures subreddits do not overlap across profiles (to avoid duplicate alerts).
- Requires `DISCORD_WEBHOOK_URL` in the environment.

### 3) RSS ingestion

RSS feeds are fetched with a custom User-Agent and a timeout. The response XML is parsed into items, then normalized into a consistent structure:

- **postId** (extracted from GUID or link)
- **subreddit**
- **title**
- **body** (from RSS content/summary)
- **link**
- **publishedAt** (unix seconds)

Items without a valid post ID are discarded.

### 4) Keyword matching

Each normalized post is checked against the profile’s keywords. Matching is case-insensitive and searches both title and body. The first matching keyword is recorded and used in the alert message.

### 5) Persistence, dedupe, and retention

SQLite is used to ensure alerts are only sent once per post per profile.

Schema highlights:

- **posts** table keyed by `(profile_id, post_id)`
- `alerted_at` is set after a successful Discord alert
- `last_error` stores the last webhook failure message

Workflow:

- Insert post if new.
- If already alerted, skip.
- Otherwise, attempt alert and set `alerted_at` on success.
- On failure, store `last_error` and continue.

Retention cleanup deletes rows where `first_seen_at` is older than the configured `retentionDays`.

### 6) Discord notifications

Alerts are sent via a Discord webhook. The message includes:

- Keyword
- Profile name (if provided)
- Subreddit
- Title
- Link

Failures bubble up to be logged and stored in SQLite for troubleshooting.

## Operational notes

- The service is stateless except for SQLite data.
- Polls are sequential across profiles in a single loop.
- Health checks are always available even while polling.
- WAL mode is enabled for SQLite to improve durability and concurrency.

## Configuration reference

Environment variables:

- **DISCORD_WEBHOOK_URL** (required): Discord webhook URL for alerts.

Defaults (override by editing `src/constants.js`):

- `DEFAULT_POLL_INTERVAL_SECONDS` (300)
- `DEFAULT_RETENTION_DAYS` (60)
- `DEFAULT_PORT` (4009)
- `DEFAULT_SQLITE_PATH` (./data/reddit-monitor.sqlite)
- `DEFAULT_USER_AGENT` (reddit-monitor/1.0 (internal))

## Example profile (tasks)

Each task in `src/tasks.js` defines the subreddits to watch and the keywords to match. The service automatically derives the RSS URL in the form:

```
https://www.reddit.com/r/<sub1>+<sub2>+.../new/.rss
```

## Troubleshooting

- **No alerts:** Verify keywords and ensure `DISCORD_WEBHOOK_URL` is set.
- **HTTP 429/403 from Reddit:** Increase poll interval or adjust User-Agent.
- **Duplicate alerts:** Check for overlapping subreddits across profiles.
- **Discord failures:** Check `last_error` in SQLite for details.
