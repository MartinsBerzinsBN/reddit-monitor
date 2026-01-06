const path = require("path");

const {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_PORT,
  DEFAULT_SQLITE_PATH,
  DEFAULT_USER_AGENT,
} = require("./constants");

const { TASKS } = require("./tasks");
const { normalizeKeywords } = require("./keywords");

function buildFeedUrl(subreddits) {
  return `https://www.reddit.com/r/${subreddits.join("+")}/new/.rss`;
}

function assertNoOverlappingSubreddits(profiles) {
  const seen = new Map();
  for (const profile of profiles) {
    for (const subreddit of profile.subreddits) {
      const key = String(subreddit || "")
        .trim()
        .toLowerCase();
      if (!key) continue;
      const prev = seen.get(key);
      if (prev && prev !== profile.id) {
        throw new Error(
          `Profiles must not overlap subreddits. Duplicate: r/${subreddit} in ${prev} and ${profile.id}`
        );
      }
      seen.set(key, profile.id);
    }
  }
}

function assertValidProfileIds(profiles) {
  const seen = new Set();
  for (const profile of profiles) {
    const id = String(profile.id || "").trim();
    if (!id) throw new Error("Each task must have a non-empty ID");
    if (seen.has(id)) throw new Error(`Duplicate task ID: ${id}`);
    seen.add(id);
  }
}

function loadConfig(env) {
  const pollIntervalSeconds = DEFAULT_POLL_INTERVAL_SECONDS;
  const retentionDays = DEFAULT_RETENTION_DAYS;
  const port = DEFAULT_PORT;

  const sqlitePath = DEFAULT_SQLITE_PATH;
  const userAgent = DEFAULT_USER_AGENT;

  const discordWebhookUrl = (env.DISCORD_WEBHOOK_URL || "").trim();
  if (!discordWebhookUrl) {
    throw new Error("Missing required env var: DISCORD_WEBHOOK_URL");
  }

  const profiles = (TASKS || []).map((task, idx) => {
    const subreddits = task?.SUBREDDITS || [];
    const rawKeywords = task?.KEYWORDS || [];
    const keywords = normalizeKeywords(rawKeywords);

    const id = String(task?.ID || "").trim() || `task${idx + 1}`;

    return {
      id,
      name: (task?.NAME || "").trim() || null,
      subreddits,
      keywords,
      feedUrl: buildFeedUrl(subreddits),
    };
  });

  if (!profiles.length) {
    throw new Error("No TASKS configured. Add entries to src/tasks.js");
  }

  assertValidProfileIds(profiles);
  assertNoOverlappingSubreddits(profiles);

  return {
    port,
    pollIntervalSeconds,
    retentionDays,
    sqlitePath: path.resolve(sqlitePath),
    userAgent,
    discordWebhookUrl,
    profiles,
  };
}

module.exports = { loadConfig };
