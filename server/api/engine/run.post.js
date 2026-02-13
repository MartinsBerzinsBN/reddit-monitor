export default defineEventHandler(async () => {
  try {
    const taskResult = await runTask("engine:ingest");
    const stats = taskResult?.result?.stats || null;

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
