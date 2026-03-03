export function initSchema(db, { sqliteVecLoaded = false } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      ID TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      username TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS opportunity_clusters (
      ID TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      solution_idea TEXT NOT NULL,
      post_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'new',
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clusters_post_count ON opportunity_clusters(post_count DESC);
    CREATE INDEX IF NOT EXISTS idx_clusters_last_seen ON opportunity_clusters(last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_clusters_status ON opportunity_clusters(status);

    CREATE TABLE IF NOT EXISTS analyzed_posts (
      ID TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL,
      subreddit TEXT,
      title TEXT,
      body TEXT,
      url TEXT,
      created_at INTEGER NOT NULL,
      link_check_stage INTEGER NOT NULL DEFAULT 0,
      link_last_checked_at INTEGER,
      link_next_check_at INTEGER,
      link_last_check_status TEXT,
      FOREIGN KEY (cluster_id) REFERENCES opportunity_clusters(ID) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_posts_cluster_id ON analyzed_posts(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON analyzed_posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_link_next_check_at ON analyzed_posts(link_next_check_at);

    CREATE TABLE IF NOT EXISTS ingest_settings (
      ID TEXT PRIMARY KEY,
      subreddit_list TEXT NOT NULL,
      heuristic_patterns TEXT NOT NULL,
      cron_ingest_enabled INTEGER NOT NULL DEFAULT 1,
      link_quality_check_enabled INTEGER NOT NULL DEFAULT 1,
      link_quality_batch_size INTEGER NOT NULL DEFAULT 50,
      cluster_distance_threshold REAL NOT NULL DEFAULT 0.65,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS link_quality_runs (
      ID TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      skipped INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      total_due INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 0,
      unknown_error INTEGER NOT NULL DEFAULT 0,
      removed_deleted INTEGER NOT NULL DEFAULT 0,
      rss_hits INTEGER NOT NULL DEFAULT 0,
      direct_checks INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_link_quality_runs_finished_at ON link_quality_runs(finished_at DESC);
  `);

  const analyzedPostsColumns = db
    .prepare("PRAGMA table_info(analyzed_posts)")
    .all();
  const hasLinkCheckStage = analyzedPostsColumns.some(
    (column) => column.name === "link_check_stage",
  );
  const hasLinkLastCheckedAt = analyzedPostsColumns.some(
    (column) => column.name === "link_last_checked_at",
  );
  const hasLinkNextCheckAt = analyzedPostsColumns.some(
    (column) => column.name === "link_next_check_at",
  );
  const hasLinkLastCheckStatus = analyzedPostsColumns.some(
    (column) => column.name === "link_last_check_status",
  );

  if (!hasLinkCheckStage) {
    db.exec(`
      ALTER TABLE analyzed_posts
      ADD COLUMN link_check_stage INTEGER NOT NULL DEFAULT 0
    `);
  }

  if (!hasLinkLastCheckedAt) {
    db.exec(`
      ALTER TABLE analyzed_posts
      ADD COLUMN link_last_checked_at INTEGER
    `);
  }

  if (!hasLinkNextCheckAt) {
    db.exec(`
      ALTER TABLE analyzed_posts
      ADD COLUMN link_next_check_at INTEGER
    `);
  }

  if (!hasLinkLastCheckStatus) {
    db.exec(`
      ALTER TABLE analyzed_posts
      ADD COLUMN link_last_check_status TEXT
    `);
  }

  db.exec(`
    UPDATE analyzed_posts
    SET link_next_check_at = created_at + 600
    WHERE link_next_check_at IS NULL AND link_check_stage = 0
  `);

  const ingestSettingsColumns = db
    .prepare("PRAGMA table_info(ingest_settings)")
    .all();
  const hasCronIngestEnabled = ingestSettingsColumns.some(
    (column) => column.name === "cron_ingest_enabled",
  );
  const hasLinkQualityCheckEnabled = ingestSettingsColumns.some(
    (column) => column.name === "link_quality_check_enabled",
  );
  const hasLinkQualityBatchSize = ingestSettingsColumns.some(
    (column) => column.name === "link_quality_batch_size",
  );
  const hasClusterDistanceThreshold = ingestSettingsColumns.some(
    (column) => column.name === "cluster_distance_threshold",
  );

  if (!hasCronIngestEnabled) {
    db.exec(`
      ALTER TABLE ingest_settings
      ADD COLUMN cron_ingest_enabled INTEGER NOT NULL DEFAULT 1
    `);
  }

  if (!hasClusterDistanceThreshold) {
    db.exec(`
      ALTER TABLE ingest_settings
      ADD COLUMN cluster_distance_threshold REAL NOT NULL DEFAULT 0.65
    `);
  }

  if (!hasLinkQualityCheckEnabled) {
    db.exec(`
      ALTER TABLE ingest_settings
      ADD COLUMN link_quality_check_enabled INTEGER NOT NULL DEFAULT 1
    `);
  }

  if (!hasLinkQualityBatchSize) {
    db.exec(`
      ALTER TABLE ingest_settings
      ADD COLUMN link_quality_batch_size INTEGER NOT NULL DEFAULT 50
    `);
  }

  if (sqliteVecLoaded) {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_opportunities
      USING vec0(embedding FLOAT[1536]);
    `);
  }
}
