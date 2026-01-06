function normalizeKeywords(keywords) {
  const out = [];
  const seen = new Set();
  for (const raw of keywords || []) {
    const k = String(raw || "")
      .trim()
      .toLowerCase();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function findKeywordMatch(title, body, keywords) {
  const haystack = `${title || ""}\n${body || ""}`.toLowerCase();
  for (const keyword of keywords || []) {
    if (haystack.includes(keyword)) return keyword;
  }
  return null;
}

module.exports = { normalizeKeywords, findKeywordMatch };
