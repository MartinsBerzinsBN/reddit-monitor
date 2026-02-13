import { runIngestion } from "../../lib/engine";
import { getIngestSettings } from "../../lib/sqlite-helpers";

export default defineTask({
  meta: {
    name: "engine:ingest",
    description: "Fetch, analyze, and cluster Reddit opportunities.",
  },
  async run() {
    const settings = getIngestSettings();

    const stats = await runIngestion({
      subredditList: settings.subreddit_list,
      heuristicPatterns: settings.heuristic_patterns,
    });

    return {
      result: {
        success: true,
        stats,
      },
    };
  },
});
