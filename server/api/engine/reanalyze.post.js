import { rerunAnalysisForExistingPosts } from "../../lib/engine";

export default defineEventHandler(async () => {
  try {
    const stats = await rerunAnalysisForExistingPosts();

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
