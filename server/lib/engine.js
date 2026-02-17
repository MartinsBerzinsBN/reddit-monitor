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
import {
  getIngestSettings,
  isPostAlreadyAnalyzed,
  listAllAnalyzedPosts,
  pruneOrphanClusters,
  resetOpportunityData,
} from "./sqlite-helpers";
import { sendDiscordNewPostNotification } from "./notifications";
import {
  completeReanalyzeProgress,
  failReanalyzeProgress,
  startReanalyzeProgress,
  updateReanalyzeProgress,
} from "./reanalyze-progress";

export async function runIngestion({
  subredditList,
  heuristicPatterns,
  clusterDistanceThreshold,
} = {}) {
  if (!sqliteVecReady) {
    throw new Error(
      "sqlite-vec extension is not available. Install/load sqlite-vec before running ingestion.",
    );
  }

  const settings = getIngestSettings();
  const effectiveSubredditList = subredditList || settings.subreddit_list;
  const effectiveHeuristicPatterns =
    heuristicPatterns || settings.heuristic_patterns;

  const parsedThreshold = Number(clusterDistanceThreshold);
  const effectiveClusterDistanceThreshold = Number.isFinite(parsedThreshold)
    ? parsedThreshold
    : settings.cluster_distance_threshold;

  const now = Math.floor(Date.now() / 1000);
  const regex = buildPainRegex(effectiveHeuristicPatterns);

  console.log(
    `[engine] ingest start configured_subreddits=${(effectiveSubredditList || []).join(",")} threshold=${effectiveClusterDistanceThreshold}`,
  );

  const feed = await fetchRssFeed({
    subreddits: effectiveSubredditList,
    userAgent: DEFAULT_USER_AGENT,
  });

  const posts = normalizeFeedItems(feed);
  const filtered = posts.filter((post) =>
    passesHeuristicFilter({ title: post.title, body: post.body, regex }),
  );
  const seenSubreddits = [
    ...new Set(posts.map((post) => post.subreddit).filter(Boolean)),
  ];
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
    const nearest = findNearestCluster(
      embedding,
      effectiveClusterDistanceThreshold,
    );

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

export async function rerunAnalysisForExistingPosts({
  reuseExistingAnalysis = false,
  clusterDistanceThreshold,
} = {}) {
  if (!sqliteVecReady) {
    throw new Error(
      "sqlite-vec extension is not available. Install/load sqlite-vec before running re-analysis.",
    );
  }

  const settings = getIngestSettings();
  const parsedThreshold = Number(clusterDistanceThreshold);
  const effectiveClusterDistanceThreshold = Number.isFinite(parsedThreshold)
    ? parsedThreshold
    : settings.cluster_distance_threshold;

  try {
    const existingPosts = listAllAnalyzedPosts();
    const mode = reuseExistingAnalysis ? "recluster" : "reanalyze";

    console.log(
      `[engine] ${mode} start existing_posts=${existingPosts.length}`,
    );

    startReanalyzeProgress(existingPosts.length);

    const stats = {
      total: existingPosts.length,
      analyzed: 0,
      clusteredExisting: 0,
      clusteredNew: 0,
      skipped: 0,
      reusedAnalysis: 0,
    };

    if (!existingPosts.length) {
      completeReanalyzeProgress(stats);
      console.log(`[engine] ${mode} done existing_posts=0`);
      return stats;
    }

    console.log(`[engine] ${mode} reset existing clusters and vectors`);
    resetOpportunityData();

    const now = Math.floor(Date.now() / 1000);

    for (const stored of existingPosts) {
      let analysis = null;

      if (reuseExistingAnalysis && stored.pain_point_summary) {
        analysis = {
          is_opportunity: true,
          pain_point_summary: stored.pain_point_summary,
          proposed_solution:
            stored.existing_solution_idea || "No AI idea available.",
        };
        stats.reusedAnalysis += 1;
      } else {
        analysis = await analyzePost(stored.title, stored.body);
      }

      stats.analyzed += 1;

      updateReanalyzeProgress({
        processed: stats.analyzed,
        message: `${reuseExistingAnalysis ? "Processed" : "Analyzed"} ${stats.analyzed}/${stats.total}`,
      });

      if (stats.analyzed % 10 === 0 || stats.analyzed === stats.total) {
        console.log(
          `[engine] ${mode} progress analyzed=${stats.analyzed}/${stats.total}`,
        );
      }

      if (!analysis.is_opportunity) {
        stats.skipped += 1;
        continue;
      }

      const embedding = await getEmbedding(analysis.pain_point_summary);
      const nearest = findNearestCluster(
        embedding,
        effectiveClusterDistanceThreshold,
      );
      const post = {
        postId: stored.ID,
        subreddit: stored.subreddit,
        title: stored.title,
        body: stored.body,
        link: stored.url,
        publishedAt: stored.created_at,
      };

      if (nearest?.clusterId) {
        attachPostToCluster({ clusterId: nearest.clusterId, post, now });
        stats.clusteredExisting += 1;
        continue;
      }

      createClusterFromPost({
        analysis: {
          ...analysis,
          proposed_solution:
            analysis.proposed_solution ||
            stored.existing_solution_idea ||
            "No AI idea available.",
        },
        embedding,
        post,
        now,
      });
      stats.clusteredNew += 1;
    }

    stats.prunedOrphans = pruneOrphanClusters();
    completeReanalyzeProgress(stats);

    console.log(
      `[engine] ${mode} done total=${stats.total} analyzed=${stats.analyzed} new=${stats.clusteredNew} existing=${stats.clusteredExisting} skipped=${stats.skipped} reused=${stats.reusedAnalysis} pruned=${stats.prunedOrphans}`,
    );

    return stats;
  } catch (error) {
    failReanalyzeProgress(error);
    throw error;
  }
}
