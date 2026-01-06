require("dotenv").config();

const express = require("express");

const { loadConfig } = require("./src/config");
const { initDb } = require("./src/db");
const { fetchRssFeed, normalizeFeedItems } = require("./src/rss");
const { findKeywordMatch } = require("./src/keywords");
const { sendDiscordWebhook } = require("./src/discord");

function unixSecondsNow() {
  return Math.floor(Date.now() / 1000);
}

async function pollOnce({ config, db }) {
  const startedAtMs = Date.now();
  const now = unixSecondsNow();

  let itemsCount = 0;
  let matchedCount = 0;
  let alertedCount = 0;

  for (const profile of config.profiles) {
    const feed = await fetchRssFeed({
      feedUrl: profile.feedUrl,
      userAgent: config.userAgent,
    });

    const posts = normalizeFeedItems(feed);
    itemsCount += posts.length;

    for (const post of posts) {
      const keyword = findKeywordMatch(post.title, post.body, profile.keywords);
      if (!keyword) continue;

      matchedCount += 1;

      const subreddit = post.subreddit || "unknown";
      const postRow = {
        profile_id: profile.id,
        post_id: post.postId,
        subreddit,
        title: post.title,
        link: post.link,
        matched_keyword: keyword,
        first_seen_at: now,
        published_at: post.publishedAt,
      };

      const { alreadyAlerted } = db.insertIfNew(postRow);
      if (alreadyAlerted) continue;

      try {
        await sendDiscordWebhook({
          webhookUrl: config.discordWebhookUrl,
          taskName: profile.name || profile.id,
          keyword,
          subreddit,
          title: post.title,
          link: post.link,
        });

        db.setAlerted(profile.id, post.postId, now);
        alertedCount += 1;
        // eslint-disable-next-line no-console
        console.log(
          `[alerted] profile=${profile.id} r/${subreddit} ${post.postId} (${keyword})`
        );
      } catch (err) {
        db.setLastError(
          profile.id,
          post.postId,
          err instanceof Error ? err.message : String(err)
        );
        // eslint-disable-next-line no-console
        console.error(`[discord-failed] ${post.postId}:`, err);
      }
    }
  }

  db.purgeRetention(config.retentionDays, now);

  const durationMs = Date.now() - startedAtMs;
  // eslint-disable-next-line no-console
  console.log(
    `[poll] done items=${itemsCount} matched=${matchedCount} alerted=${alertedCount} durationMs=${durationMs}`
  );
}

async function startPolling({ config, db }) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;

    try {
      // eslint-disable-next-line no-console
      console.log("[poll] start");
      await pollOnce({ config, db });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[poll-error]:", err);
    } finally {
      running = false;
      setTimeout(tick, config.pollIntervalSeconds * 1000);
    }
  }

  tick();
}

async function main() {
  const config = loadConfig(process.env);
  const db = initDb(config.sqlitePath);

  const app = express();
  app.get("/up", (req, res) => {
    res.status(200).send("ok");
  });

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[http] listening on :${config.port}`);
  });

  for (const profile of config.profiles) {
    // eslint-disable-next-line no-console
    console.log(`[rss] profile=${profile.id} ${profile.feedUrl}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[db] ${config.sqlitePath}`);

  await startPolling({ config, db });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[fatal]:", err);
  process.exitCode = 1;
});
