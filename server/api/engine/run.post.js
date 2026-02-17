import { runIngestion } from "../../lib/engine";
import { getIngestSettings } from "../../lib/sqlite-helpers";

export default defineEventHandler(async () => {
  try {
    const settings = getIngestSettings();
    const stats = await runIngestion({
      subredditList: settings.subreddit_list,
      heuristicPatterns: settings.heuristic_patterns,
      clusterDistanceThreshold: settings.cluster_distance_threshold,
    });

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("[engine] run failed", error);
    throw createError({
      status: 500,
      statusText: "Internal Server Error",
      message: error?.message || "Failed to run ingestion engine.",
    });
  }
});
