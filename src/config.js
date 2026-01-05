const path = require("path");

const {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_PORT,
  DEFAULT_SUBREDDITS,
  DEFAULT_SQLITE_PATH,
  DEFAULT_USER_AGENT,
} = require("./constants");

function loadConfig(env) {
  const pollIntervalSeconds = DEFAULT_POLL_INTERVAL_SECONDS;
  const retentionDays = DEFAULT_RETENTION_DAYS;
  const port = DEFAULT_PORT;

  const subreddits = DEFAULT_SUBREDDITS;
  const sqlitePath = DEFAULT_SQLITE_PATH;
  const userAgent = DEFAULT_USER_AGENT;

  const discordWebhookUrl = (env.DISCORD_WEBHOOK_URL || "").trim();
  if (!discordWebhookUrl) {
    throw new Error("Missing required env var: DISCORD_WEBHOOK_URL");
  }

  const feedUrl = `https://www.reddit.com/r/${subreddits.join("+")}/new/.rss`;

  return {
    port,
    pollIntervalSeconds,
    retentionDays,
    sqlitePath: path.resolve(sqlitePath),
    userAgent,
    discordWebhookUrl,
    subreddits,
    feedUrl,
  };
}

module.exports = { loadConfig };
