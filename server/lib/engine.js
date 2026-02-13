import { analyzePost, getEmbedding } from "./ai";
import { DEFAULT_USER_AGENT } from "./constants";
import {
  findNearestCluster,
  attachPostToCluster,
  createClusterFromPost,
} from "./clustering";
import { buildPainRegex, passesHeuristicFilter } from "./heuristics";
import { fetchRssFeed, normalizeFeedItems } from "./rss";
import { sqliteVecReady } from "./sqlite";
import { isPostAlreadyAnalyzed, pruneOrphanClusters } from "./sqlite-helpers";
import { sendDiscordNewPostNotification } from "./notifications";

export async function runIngestion({ subredditList, heuristicPatterns }) {
  if (!sqliteVecReady) {
    throw new Error(
      "sqlite-vec extension is not available. Install/load sqlite-vec before running ingestion.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const regex = buildPainRegex(heuristicPatterns);

  console.log(
    `[engine] ingest start configured_subreddits=${(subredditList || []).join(",")}`,
  );

  const feed = await fetchRssFeed({
    subreddits: subredditList,
    userAgent: DEFAULT_USER_AGENT,
  });

  const posts = normalizeFeedItems(feed);
  const filtered = posts.filter((post) =>
    passesHeuristicFilter({ title: post.title, body: post.body, regex }),
  );
  const seenSubreddits = [...new Set(posts.map((post) => post.subreddit).filter(Boolean))];
  const filteredSubreddits = [
    ...new Set(filtered.map((post) => post.subreddit).filter(Boolean)),
  ];

  console.log(
    `[engine] ingest subreddits_seen=${seenSubreddits.join(",")} subreddits_filtered=${filteredSubreddits.join(",")}`,
  );

  const stats = {
    total: posts.length,
    filtered: filtered.length,
    deduped: 0,
    analyzed: 0,
    clusteredExisting: 0,
    clusteredNew: 0,
    skipped: 0,
    prunedOrphans: 0,
    notified: 0,
    notifyErrors: 0,
  };

  for (const post of filtered) {
    if (isPostAlreadyAnalyzed(post.postId)) {
      stats.deduped += 1;
      continue;
    }

    const analysis = await analyzePost(post.title, post.body);
    stats.analyzed += 1;

    if (!analysis.is_opportunity) {
      stats.skipped += 1;
      continue;
    }

    const embedding = await getEmbedding(analysis.pain_point_summary);
    const nearest = findNearestCluster(embedding);

    if (nearest?.clusterId) {
      attachPostToCluster({ clusterId: nearest.clusterId, post, now });
      stats.clusteredExisting += 1;

      try {
        const notification = await sendDiscordNewPostNotification({
          post,
          analysis,
          clusterId: nearest.clusterId,
          clusterMode: "existing",
        });
        if (notification?.sent) {
          stats.notified += 1;
        }
      } catch (error) {
        stats.notifyErrors += 1;
        console.error("[engine] discord notify failed", error);
      }

      continue;
    }

    const clusterId = createClusterFromPost({ analysis, embedding, post, now });
    stats.clusteredNew += 1;

    try {
      const notification = await sendDiscordNewPostNotification({
        post,
        analysis,
        clusterId,
        clusterMode: "new",
      });
      if (notification?.sent) {
        stats.notified += 1;
      }
    } catch (error) {
      stats.notifyErrors += 1;
      console.error("[engine] discord notify failed", error);
    }
  }

  stats.prunedOrphans = pruneOrphanClusters();

  console.log(
    `[engine] ingest done total=${stats.total} filtered=${stats.filtered} analyzed=${stats.analyzed} new=${stats.clusteredNew} existing=${stats.clusteredExisting}`,
  );

  return stats;
}
