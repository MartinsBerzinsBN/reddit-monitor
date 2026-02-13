import { DEFAULT_HEURISTIC_PATTERNS } from "./constants";

export function normalizeTerms(items) {
  const out = [];
  const seen = new Set();

  for (const item of items || []) {
    const normalized = String(item || "")
      .trim()
      .toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

export function buildPainRegex(patterns = DEFAULT_HEURISTIC_PATTERNS) {
  const terms = normalizeTerms(patterns).map((item) =>
    item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  if (!terms.length) {
    return null;
  }

  return new RegExp(`\\b(${terms.join("|")})\\b`, "i");
}

export function passesHeuristicFilter({ title, body, regex }) {
  const haystack = `${title || ""}\n${body || ""}`;
  if (!regex) {
    return true;
  }
  return regex.test(haystack);
}
