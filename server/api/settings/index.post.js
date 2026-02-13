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

  const subredditList = normalizeStringArray(body?.subreddit_list);
  const heuristicPatterns = normalizeStringArray(body?.heuristic_patterns);

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

  upsertIngestSettings({ subredditList, heuristicPatterns });

  return {
    success: true,
    settings: getIngestSettings(),
  };
});
