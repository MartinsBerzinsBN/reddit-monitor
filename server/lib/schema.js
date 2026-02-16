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
      FOREIGN KEY (cluster_id) REFERENCES opportunity_clusters(ID) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_posts_cluster_id ON analyzed_posts(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON analyzed_posts(created_at DESC);

    CREATE TABLE IF NOT EXISTS ingest_settings (
      ID TEXT PRIMARY KEY,
      subreddit_list TEXT NOT NULL,
      heuristic_patterns TEXT NOT NULL,
      cron_ingest_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
  `);

  const ingestSettingsColumns = db
    .prepare("PRAGMA table_info(ingest_settings)")
    .all();
  const hasCronIngestEnabled = ingestSettingsColumns.some(
    (column) => column.name === "cron_ingest_enabled",
  );

  if (!hasCronIngestEnabled) {
    db.exec(`
      ALTER TABLE ingest_settings
      ADD COLUMN cron_ingest_enabled INTEGER NOT NULL DEFAULT 1
    `);
  }

  if (sqliteVecLoaded) {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_opportunities
      USING vec0(embedding FLOAT[1536]);
    `);
  }
}
