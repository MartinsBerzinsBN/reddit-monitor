import { rerunAnalysisForExistingPosts } from "../../lib/engine";

export default defineEventHandler(async () => {
  try {
    const stats = await rerunAnalysisForExistingPosts({
      reuseExistingAnalysis: true,
    });

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("[engine] re-cluster failed", error);
    throw createError({
      status: 500,
      statusText: "Internal Server Error",
      message: error?.message || "Failed to re-cluster existing posts.",
    });
  }
});
