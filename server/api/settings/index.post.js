import {
  getIngestSettings,
  upsertIngestSettings,
} from "../../lib/sqlite-helpers";

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const out = [];
  const seen = new Set();
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(normalized);
  }

  return out;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const currentSettings = getIngestSettings();

  const subredditList = normalizeStringArray(body?.subreddit_list);
  const heuristicPatterns = normalizeStringArray(body?.heuristic_patterns);
  const cronIngestEnabledRaw = body?.cron_ingest_enabled;
  const clusterDistanceThresholdRaw = body?.cluster_distance_threshold;

  if (
    cronIngestEnabledRaw !== undefined &&
    typeof cronIngestEnabledRaw !== "boolean"
  ) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "cron_ingest_enabled must be a boolean.",
    });
  }

  const cronIngestEnabled =
    cronIngestEnabledRaw === undefined
      ? currentSettings.cron_ingest_enabled
      : cronIngestEnabledRaw;

  let clusterDistanceThreshold = currentSettings.cluster_distance_threshold;
  if (clusterDistanceThresholdRaw !== undefined) {
    const parsedThreshold = Number(clusterDistanceThresholdRaw);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      throw createError({
        status: 400,
        statusText: "Bad Request",
        message: "cluster_distance_threshold must be a non-negative number.",
      });
    }

    clusterDistanceThreshold = parsedThreshold;
  }

  if (!subredditList.length) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "At least one subreddit is required.",
    });
  }

  if (!heuristicPatterns.length) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "At least one heuristic pattern is required.",
    });
  }

  upsertIngestSettings({
    subredditList,
    heuristicPatterns,
    cronIngestEnabled,
    clusterDistanceThreshold,
  });

  return {
    success: true,
    settings: getIngestSettings(),
  };
});
