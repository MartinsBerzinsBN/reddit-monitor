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
      post_id TEXT PRIMARY KEY,
      subreddit TEXT,
      title TEXT,
      link TEXT,
      matched_keyword TEXT,
      first_seen_at INTEGER NOT NULL,
      published_at INTEGER,
      alerted_at INTEGER,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_posts_first_seen_at ON posts(first_seen_at);
    CREATE INDEX IF NOT EXISTS idx_posts_alerted_at ON posts(alerted_at);
  `);

  const insertOrIgnore = db.prepare(`
    INSERT OR IGNORE INTO posts (
      post_id, subreddit, title, link, matched_keyword, first_seen_at, published_at, alerted_at, last_error
    ) VALUES (
      @post_id, @subreddit, @title, @link, @matched_keyword, @first_seen_at, @published_at, NULL, NULL
    )
  `);

  const getAlertState = db.prepare(
    "SELECT alerted_at FROM posts WHERE post_id = ?"
  );

  const markAlerted = db.prepare(
    "UPDATE posts SET alerted_at = ?, last_error = NULL WHERE post_id = ?"
  );

  const markError = db.prepare(
    "UPDATE posts SET last_error = ? WHERE post_id = ?"
  );

  const purgeOlderThanFirstSeen = db.prepare(
    "DELETE FROM posts WHERE first_seen_at < ?"
  );

  function insertIfNew(postRow) {
    insertOrIgnore.run(postRow);
    const row = getAlertState.get(postRow.post_id);
    return { alreadyAlerted: !!row?.alerted_at };
  }

  function setAlerted(postId, unixSecondsNow) {
    markAlerted.run(unixSecondsNow, postId);
  }

  function setLastError(postId, errorMessage) {
    markError.run(errorMessage, postId);
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
