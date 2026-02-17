import { runIngestion } from "../../lib/engine";
import { getIngestSettings } from "../../lib/sqlite-helpers";

export default defineTask({
  meta: {
    name: "engine:ingest",
    description: "Fetch, analyze, and cluster Reddit opportunities.",
  },
  async run() {
    const settings = getIngestSettings();

    if (!settings.cron_ingest_enabled) {
      return {
        result: {
          success: true,
          skipped: true,
          message: "Scheduled ingestion is disabled in settings.",
          stats: null,
        },
      };
    }

    const stats = await runIngestion({
      subredditList: settings.subreddit_list,
      heuristicPatterns: settings.heuristic_patterns,
      clusterDistanceThreshold: settings.cluster_distance_threshold,
    });

    return {
      result: {
        success: true,
        stats,
      },
    };
  },
});
