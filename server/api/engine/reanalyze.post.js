import { rerunAnalysisForExistingPosts } from "../../lib/engine";
import { getIngestSettings } from "../../lib/sqlite-helpers";

export default defineEventHandler(async () => {
  try {
    const settings = getIngestSettings();
    const stats = await rerunAnalysisForExistingPosts({
      clusterDistanceThreshold: settings.cluster_distance_threshold,
    });

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("[engine] re-analysis failed", error);
    throw createError({
      status: 500,
      statusText: "Internal Server Error",
      message: error?.message || "Failed to re-run analysis.",
    });
  }
});
