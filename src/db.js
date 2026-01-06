const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function initDb(sqlitePath) {
  ensureParentDir(sqlitePath);

  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      profile_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      subreddit TEXT,
      title TEXT,
      link TEXT,
      matched_keyword TEXT,
      first_seen_at INTEGER NOT NULL,
      published_at INTEGER,
      alerted_at INTEGER,
      last_error TEXT,
      PRIMARY KEY (profile_id, post_id)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_first_seen_at ON posts(first_seen_at);
    CREATE INDEX IF NOT EXISTS idx_posts_alerted_at ON posts(alerted_at);
    CREATE INDEX IF NOT EXISTS idx_posts_profile_id ON posts(profile_id);
  `);

  const insertOrIgnore = db.prepare(`
    INSERT OR IGNORE INTO posts (
      profile_id, post_id, subreddit, title, link, matched_keyword, first_seen_at, published_at, alerted_at, last_error
    ) VALUES (
      @profile_id, @post_id, @subreddit, @title, @link, @matched_keyword, @first_seen_at, @published_at, NULL, NULL
    )
  `);

  const getAlertState = db.prepare(
    "SELECT alerted_at FROM posts WHERE profile_id = ? AND post_id = ?"
  );

  const markAlerted = db.prepare(
    "UPDATE posts SET alerted_at = ?, last_error = NULL WHERE profile_id = ? AND post_id = ?"
  );

  const markError = db.prepare(
    "UPDATE posts SET last_error = ? WHERE profile_id = ? AND post_id = ?"
  );

  const purgeOlderThanFirstSeen = db.prepare(
    "DELETE FROM posts WHERE first_seen_at < ?"
  );

  function insertIfNew(postRow) {
    insertOrIgnore.run(postRow);
    const row = getAlertState.get(postRow.profile_id, postRow.post_id);
    return { alreadyAlerted: !!row?.alerted_at };
  }

  function setAlerted(profileId, postId, unixSecondsNow) {
    markAlerted.run(unixSecondsNow, profileId, postId);
  }

  function setLastError(profileId, postId, errorMessage) {
    markError.run(errorMessage, profileId, postId);
  }

  function purgeRetention(retentionDays, unixSecondsNow) {
    const cutoff = unixSecondsNow - retentionDays * 24 * 60 * 60;
    purgeOlderThanFirstSeen.run(cutoff);
  }

  return {
    db,
    insertIfNew,
    setAlerted,
    setLastError,
    purgeRetention,
  };
}

module.exports = { initDb };
