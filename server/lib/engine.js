import { analyzePost, getEmbedding } from "./ai";
import {
  DEFAULT_INGEST_LISTING_LIMIT,
  DEFAULT_INGEST_MAX_CALLS_PER_CYCLE,
  DEFAULT_INGEST_MIN_REQUEST_INTERVAL_MS,
  DEFAULT_USER_AGENT,
} from "./constants";
import {
  findNearestCluster,
  attachPostToCluster,
  createClusterFromPost,
} from "./clustering";
import { buildPainRegex, passesHeuristicFilter } from "./heuristics";
import { fetchSubredditNewListing, normalizeRedditListingItems } from "./rss";
import { sqliteVecReady } from "./sqlite";
import {
  getRedditIngestSyncStateMap,
  getIngestSettings,
  isPostAlreadyAnalyzed,
  listAllAnalyzedPosts,
  pruneOrphanClusters,
  resetOpportunityData,
  upsertRedditIngestSyncState,
} from "./sqlite-helpers";
import { sendDiscordNewPostNotification } from "./notifications";
import {
  completeReanalyzeProgress,
  failReanalyzeProgress,
  startReanalyzeProgress,
  updateReanalyzeProgress,
} from "./reanalyze-progress";

let ingestLimiterChain = Promise.resolve();
let lastIngestRequestAt = 0;

function normalizeSubredditList(subredditList = []) {
  return [
    ...new Set(
      subredditList.map((item) =>
        String(item || "")
          .trim()
          .toLowerCase(),
      ),
    ),
  ].filter(Boolean);
}

function runWithIngestLimiter(task) {
  const run = async () => {
    const elapsed = Date.now() - lastIngestRequestAt;
    const waitMs = Math.max(
      0,
      DEFAULT_INGEST_MIN_REQUEST_INTERVAL_MS - elapsed,
    );

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    try {
      return await task();
    } finally {
      lastIngestRequestAt = Date.now();
    }
  };

  const scheduled = ingestLimiterChain.then(run, run);
  ingestLimiterChain = scheduled.catch(() => {});
  return scheduled;
}

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
  const effectiveSubredditList = normalizeSubredditList(
    subredditList || settings.subreddit_list,
  );
  const effectiveHeuristicPatterns =
    heuristicPatterns || settings.heuristic_patterns;

  const parsedThreshold = Number(clusterDistanceThreshold);
  const effectiveClusterDistanceThreshold = Number.isFinite(parsedThreshold)
    ? parsedThreshold
    : settings.cluster_distance_threshold;

  const now = Math.floor(Date.now() / 1000);
  const regex = buildPainRegex(effectiveHeuristicPatterns);
  const syncStateMap = getRedditIngestSyncStateMap(effectiveSubredditList);
  const sortedSubreddits = [...effectiveSubredditList].sort((a, b) => {
    const aChecked = Number(syncStateMap[a]?.last_checked_at || 0);
    const bChecked = Number(syncStateMap[b]?.last_checked_at || 0);
    return aChecked - bChecked;
  });
  const cycleSubreddits = sortedSubreddits.slice(
    0,
    DEFAULT_INGEST_MAX_CALLS_PER_CYCLE,
  );

  console.log(
    `[engine] ingest start configured_subreddits=${effectiveSubredditList.join(",")} cycle_subreddits=${cycleSubreddits.join(",")} threshold=${effectiveClusterDistanceThreshold}`,
  );

  const posts = [];
  const fetchErrors = [];

  for (const subreddit of cycleSubreddits) {
    const state = syncStateMap[subreddit] || null;

    try {
      const listing = await runWithIngestLimiter(() =>
        fetchSubredditNewListing({
          subreddit,
          limit: DEFAULT_INGEST_LISTING_LIMIT,
          userAgent: DEFAULT_USER_AGENT,
        }),
      );
      const fetchedPosts = normalizeRedditListingItems(listing, { subreddit });

      let incrementalPosts = fetchedPosts;
      if (state?.last_seen_fullname) {
        const markerIndex = fetchedPosts.findIndex(
          (post) => post.fullname === state.last_seen_fullname,
        );

        if (markerIndex >= 0) {
          incrementalPosts = fetchedPosts.slice(0, markerIndex);
        }
      }

      posts.push(...incrementalPosts);

      upsertRedditIngestSyncState({
        subreddit,
        lastSeenFullname:
          fetchedPosts[0]?.fullname || state?.last_seen_fullname || null,
        lastSeenCreatedUtc:
          fetchedPosts[0]?.publishedAt || state?.last_seen_created_utc || null,
        lastCheckedAt: now,
      });
    } catch (error) {
      fetchErrors.push(subreddit);
      console.error(`[engine] subreddit fetch failed r/${subreddit}`, error);

      upsertRedditIngestSyncState({
        subreddit,
        lastSeenFullname: state?.last_seen_fullname || null,
        lastSeenCreatedUtc: state?.last_seen_created_utc || null,
        lastCheckedAt: now,
      });
    }
  }

  const filtered = posts.filter((post) =>
    passesHeuristicFilter({ title: post.title, body: post.body, regex }),
  );
  const seenSubreddits = cycleSubreddits;
  const filteredSubreddits = [
    ...new Set(filtered.map((post) => post.subreddit).filter(Boolean)),
  ];

  console.log(
    `[engine] ingest calls=${cycleSubreddits.length} fetch_errors=${fetchErrors.length} subreddits_seen=${seenSubreddits.join(",")} subreddits_filtered=${filteredSubreddits.join(",")}`,
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
    redditRequests: cycleSubreddits.length,
    fetchErrors: fetchErrors.length,
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
