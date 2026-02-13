import db from "./sqlite";
import {
  bumpCluster,
  createCluster,
  insertAnalyzedPost,
} from "./sqlite-helpers";
import { generateUUID } from "./uuid";
import { DEFAULT_CLUSTER_DISTANCE_THRESHOLD } from "./constants";

export function findNearestCluster(
  embedding,
  threshold = DEFAULT_CLUSTER_DISTANCE_THRESHOLD,
) {
  const stmt = db.prepare(`
    SELECT rowid, distance
    FROM vec_opportunities
    WHERE embedding MATCH ?
      AND k = 1
  `);

  const vectorMatch = stmt.get(JSON.stringify(embedding));

  if (!vectorMatch) {
    return null;
  }

  if (vectorMatch.distance > threshold) {
    return null;
  }

  const clusterStmt = db.prepare(
    "SELECT ID FROM opportunity_clusters WHERE rowid = ? LIMIT 1",
  );
  const cluster = clusterStmt.get(vectorMatch.rowid);

  return cluster
    ? {
        clusterId: cluster.ID,
        distance: vectorMatch.distance,
        rowid: vectorMatch.rowid,
      }
    : null;
}

export function attachPostToCluster({ clusterId, post, now }) {
  const inserted = insertAnalyzedPost({
    ID: post.postId,
    clusterId,
    subreddit: post.subreddit,
    title: post.title,
    body: post.body,
    url: post.link,
    createdAt: post.publishedAt || now,
  });

  if (inserted) {
    bumpCluster(clusterId, now);
  }

  return clusterId;
}

export function createClusterFromPost({ analysis, embedding, post, now }) {
  const clusterId = generateUUID();

  const transaction = db.transaction(() => {
    createCluster({
      ID: clusterId,
      title: analysis.pain_point_summary,
      description: analysis.pain_point_summary,
      solutionIdea: analysis.proposed_solution,
      now,
    });

    const row = db
      .prepare("SELECT rowid FROM opportunity_clusters WHERE ID = ? LIMIT 1")
      .get(clusterId);

    if (!row?.rowid) {
      throw new Error("Failed to resolve cluster rowid for vector insert.");
    }

    const vecRowId =
      typeof row.rowid === "bigint"
        ? row.rowid
        : BigInt(Math.trunc(Number(row.rowid)));

    db.prepare(
      "INSERT INTO vec_opportunities(rowid, embedding) VALUES(?, ?)",
    ).run(vecRowId, JSON.stringify(embedding));

    const inserted = insertAnalyzedPost({
      ID: post.postId,
      clusterId,
      subreddit: post.subreddit,
      title: post.title,
      body: post.body,
      url: post.link,
      createdAt: post.publishedAt || now,
    });

    if (!inserted) {
      throw new Error("Post already analyzed; skipping new cluster creation.");
    }
  });

  transaction();
  return clusterId;
}
