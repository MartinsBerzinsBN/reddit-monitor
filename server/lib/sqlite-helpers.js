import db from "./sqlite";
import { DEFAULT_HEURISTIC_PATTERNS, DEFAULT_SUBREDDITS } from "./constants";

const DEFAULT_SETTINGS_ID = "default";

export function getUserByEmail(email) {
  const stmt = db.prepare(
    "SELECT ID, email, username, password_hash, created_at FROM users WHERE email = ?",
  );
  return stmt.get(email) || null;
}

export function createUser({ ID, email, username, passwordHash, createdAt }) {
  const stmt = db.prepare(
    "INSERT INTO users (ID, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  stmt.run(ID, email, username, passwordHash, createdAt);
}

export function listOpportunities({ sort = "demand" } = {}) {
  const orderBy =
    sort === "fresh"
      ? "last_seen_at DESC, post_count DESC"
      : "post_count DESC, last_seen_at DESC";

  const query = `
    SELECT
      c.ID,
      c.title,
      c.description,
      c.solution_idea,
      c.post_count,
      c.status,
      c.last_seen_at,
      c.created_at,
      GROUP_CONCAT(DISTINCT p.subreddit) AS subreddits
    FROM opportunity_clusters c
    LEFT JOIN analyzed_posts p ON p.cluster_id = c.ID
    GROUP BY c.ID
    ORDER BY ${orderBy}
  `;

  return db
    .prepare(query)
    .all()
    .map((item) => ({
      ...item,
      subreddit_sources: item.subreddits
        ? item.subreddits.split(",").filter(Boolean)
        : [],
    }));
}

export function getOpportunityById(id) {
  const stmt = db.prepare(
    "SELECT ID, title, description, solution_idea, post_count, status, last_seen_at, created_at FROM opportunity_clusters WHERE ID = ?",
  );
  return stmt.get(id) || null;
}

export function getPostsByClusterId(clusterId) {
  const stmt = db.prepare(
    "SELECT ID, subreddit, title, body, url, created_at FROM analyzed_posts WHERE cluster_id = ? ORDER BY created_at DESC",
  );
  return stmt.all(clusterId);
}

export function isPostAlreadyAnalyzed(postId) {
  const stmt = db.prepare("SELECT 1 FROM analyzed_posts WHERE ID = ? LIMIT 1");
  return !!stmt.get(postId);
}

export function upsertIngestSettings({ subredditList, heuristicPatterns }) {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `
      INSERT INTO ingest_settings (ID, subreddit_list, heuristic_patterns, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ID) DO UPDATE SET
        subreddit_list = excluded.subreddit_list,
        heuristic_patterns = excluded.heuristic_patterns,
        updated_at = excluded.updated_at
    `,
  );

  stmt.run(
    DEFAULT_SETTINGS_ID,
    JSON.stringify(subredditList || []),
    JSON.stringify(heuristicPatterns || []),
    now,
  );
}

export function getIngestSettings() {
  const stmt = db.prepare(
    "SELECT subreddit_list, heuristic_patterns, updated_at FROM ingest_settings WHERE ID = ?",
  );
  const row = stmt.get(DEFAULT_SETTINGS_ID);

  if (!row) {
    return {
      subreddit_list: DEFAULT_SUBREDDITS,
      heuristic_patterns: DEFAULT_HEURISTIC_PATTERNS,
      updated_at: null,
    };
  }

  return {
    subreddit_list: JSON.parse(row.subreddit_list || "[]"),
    heuristic_patterns: JSON.parse(row.heuristic_patterns || "[]"),
    updated_at: row.updated_at,
  };
}

export function createCluster({ ID, title, description, solutionIdea, now }) {
  const stmt = db.prepare(
    `
      INSERT INTO opportunity_clusters (
        ID,
        title,
        description,
        solution_idea,
        post_count,
        status,
        last_seen_at,
        created_at
      ) VALUES (?, ?, ?, ?, 1, 'new', ?, ?)
    `,
  );
  stmt.run(ID, title, description, solutionIdea, now, now);
}

export function bumpCluster(clusterId, now) {
  const stmt = db.prepare(
    "UPDATE opportunity_clusters SET post_count = post_count + 1, last_seen_at = ? WHERE ID = ?",
  );
  stmt.run(now, clusterId);
}

export function pruneOrphanClusters() {
  const stmt = db.prepare(`
    DELETE FROM opportunity_clusters
    WHERE ID IN (
      SELECT c.ID
      FROM opportunity_clusters c
      LEFT JOIN analyzed_posts p ON p.cluster_id = c.ID
      WHERE p.ID IS NULL
    )
  `);

  const result = stmt.run();
  return result.changes;
}

export function insertAnalyzedPost({
  ID,
  clusterId,
  subreddit,
  title,
  body,
  url,
  createdAt,
}) {
  const stmt = db.prepare(
    `
      INSERT OR IGNORE INTO analyzed_posts (
        ID,
        cluster_id,
        subreddit,
        title,
        body,
        url,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  const result = stmt.run(
    ID,
    clusterId,
    subreddit,
    title,
    body,
    url,
    createdAt,
  );
  return result.changes > 0;
}
