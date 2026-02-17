import db from "./sqlite";
import {
  DEFAULT_CLUSTER_DISTANCE_THRESHOLD,
  DEFAULT_HEURISTIC_PATTERNS,
  DEFAULT_SUBREDDITS,
} from "./constants";

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

  let vectorStmt = null;
  try {
    vectorStmt = db.prepare(
      "SELECT embedding FROM vec_opportunities WHERE rowid = ? LIMIT 1",
    );
  } catch {
    vectorStmt = null;
  }

  const toVectorString = (value) => {
    if (value == null) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return `[${value.join(", ")}]`;
    }

    if (value instanceof Uint8Array) {
      const length = Math.floor(value.byteLength / 4);
      if (!length) {
        return null;
      }

      const floats = new Float32Array(value.buffer, value.byteOffset, length);
      return `[${Array.from(floats).join(", ")}]`;
    }

    return String(value);
  };

  const query = `
    SELECT
      c.ID,
      c.rowid AS cluster_rowid,
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
    .map((item) => {
      let vectorString = null;

      if (vectorStmt && item.cluster_rowid != null) {
        const row = vectorStmt.get(item.cluster_rowid);
        vectorString = toVectorString(row?.embedding);
      }

      return {
        ...item,
        vector_string: vectorString,
        subreddit_sources: item.subreddits
          ? item.subreddits.split(",").filter(Boolean)
          : [],
      };
    })
    .map(({ cluster_rowid, ...item }) => item);
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

export function listAllAnalyzedPosts() {
  const stmt = db.prepare(
    `
      SELECT
        p.ID,
        p.subreddit,
        p.title,
        p.body,
        p.url,
        p.created_at,
        c.description AS pain_point_summary,
        c.solution_idea AS existing_solution_idea
      FROM analyzed_posts p
      LEFT JOIN opportunity_clusters c ON c.ID = p.cluster_id
      ORDER BY p.created_at ASC
    `,
  );
  return stmt.all();
}

export function resetOpportunityData() {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM analyzed_posts").run();
    db.prepare("DELETE FROM vec_opportunities").run();
    db.prepare("DELETE FROM opportunity_clusters").run();
  });

  transaction();
}

export function isPostAlreadyAnalyzed(postId) {
  const stmt = db.prepare("SELECT 1 FROM analyzed_posts WHERE ID = ? LIMIT 1");
  return !!stmt.get(postId);
}

export function upsertIngestSettings({
  subredditList,
  heuristicPatterns,
  cronIngestEnabled = true,
  clusterDistanceThreshold = DEFAULT_CLUSTER_DISTANCE_THRESHOLD,
}) {
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `
      INSERT INTO ingest_settings (
        ID,
        subreddit_list,
        heuristic_patterns,
        cron_ingest_enabled,
        cluster_distance_threshold,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(ID) DO UPDATE SET
        subreddit_list = excluded.subreddit_list,
        heuristic_patterns = excluded.heuristic_patterns,
        cron_ingest_enabled = excluded.cron_ingest_enabled,
        cluster_distance_threshold = excluded.cluster_distance_threshold,
        updated_at = excluded.updated_at
    `,
  );

  const normalizedThreshold = Number(clusterDistanceThreshold);

  stmt.run(
    DEFAULT_SETTINGS_ID,
    JSON.stringify(subredditList || []),
    JSON.stringify(heuristicPatterns || []),
    cronIngestEnabled ? 1 : 0,
    Number.isFinite(normalizedThreshold)
      ? normalizedThreshold
      : DEFAULT_CLUSTER_DISTANCE_THRESHOLD,
    now,
  );
}

export function getIngestSettings() {
  const stmt = db.prepare(
    "SELECT subreddit_list, heuristic_patterns, cron_ingest_enabled, cluster_distance_threshold, updated_at FROM ingest_settings WHERE ID = ?",
  );
  const row = stmt.get(DEFAULT_SETTINGS_ID);

  if (!row) {
    return {
      subreddit_list: DEFAULT_SUBREDDITS,
      heuristic_patterns: DEFAULT_HEURISTIC_PATTERNS,
      cron_ingest_enabled: true,
      cluster_distance_threshold: DEFAULT_CLUSTER_DISTANCE_THRESHOLD,
      updated_at: null,
    };
  }

  const parsedThreshold = Number(row.cluster_distance_threshold);

  return {
    subreddit_list: JSON.parse(row.subreddit_list || "[]"),
    heuristic_patterns: JSON.parse(row.heuristic_patterns || "[]"),
    cron_ingest_enabled:
      row.cron_ingest_enabled === undefined || row.cron_ingest_enabled === null
        ? true
        : Number(row.cron_ingest_enabled) === 1,
    cluster_distance_threshold: Number.isFinite(parsedThreshold)
      ? parsedThreshold
      : DEFAULT_CLUSTER_DISTANCE_THRESHOLD,
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

export function deletePostFromCluster({ clusterId, postId }) {
  const transaction = db.transaction(() => {
    const post = db
      .prepare(
        "SELECT ID, cluster_id FROM analyzed_posts WHERE ID = ? AND cluster_id = ? LIMIT 1",
      )
      .get(postId, clusterId);

    if (!post) {
      return { deleted: false, clusterRemoved: false };
    }

    const deleteResult = db
      .prepare("DELETE FROM analyzed_posts WHERE ID = ?")
      .run(postId);

    if (!deleteResult.changes) {
      return { deleted: false, clusterRemoved: false };
    }

    const remaining = db
      .prepare(
        "SELECT COUNT(*) AS count FROM analyzed_posts WHERE cluster_id = ?",
      )
      .get(clusterId);
    const remainingCount = Number(remaining?.count || 0);

    if (remainingCount <= 0) {
      const clusterRow = db
        .prepare("SELECT rowid FROM opportunity_clusters WHERE ID = ? LIMIT 1")
        .get(clusterId);

      if (clusterRow?.rowid != null) {
        try {
          db.prepare("DELETE FROM vec_opportunities WHERE rowid = ?").run(
            clusterRow.rowid,
          );
        } catch {
          // vec table may not exist if sqlite-vec failed to load
        }
      }

      db.prepare("DELETE FROM opportunity_clusters WHERE ID = ?").run(
        clusterId,
      );
      return { deleted: true, clusterRemoved: true };
    }

    const latestPost = db
      .prepare(
        "SELECT MAX(created_at) AS latest_created_at FROM analyzed_posts WHERE cluster_id = ?",
      )
      .get(clusterId);

    db.prepare(
      "UPDATE opportunity_clusters SET post_count = ?, last_seen_at = COALESCE(?, last_seen_at) WHERE ID = ?",
    ).run(remainingCount, latestPost?.latest_created_at || null, clusterId);

    return { deleted: true, clusterRemoved: false };
  });

  return transaction();
}
