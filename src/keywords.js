const KEYWORDS = [
  "vod review",
  "replay",
  "recording",
  "low fps",
  "overwolf",
  "insights.gg",
  "record games",
];

function findKeywordMatch(title, body) {
  const haystack = `${title || ""}\n${body || ""}`.toLowerCase();
  for (const keyword of KEYWORDS) {
    if (haystack.includes(keyword)) return keyword;
  }
  return null;
}

module.exports = { KEYWORDS, findKeywordMatch };
