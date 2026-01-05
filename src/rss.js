const Parser = require("rss-parser");

function unixSecondsFromDateString(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function extractPostIdFromUrl(url) {
  if (!url) return null;

  const commentsMatch = url.match(/\/comments\/([a-z0-9]+)\//i);
  if (commentsMatch) return commentsMatch[1];

  const reddItMatch = url.match(/redd\.it\/([a-z0-9]+)\/?$/i);
  if (reddItMatch) return reddItMatch[1];

  return null;
}

function extractPostId({ link, guid }) {
  const fromGuidThing = (guid || "").match(/\bt3_([a-z0-9]+)\b/i);
  if (fromGuidThing) return fromGuidThing[1];

  const fromGuidUrl = extractPostIdFromUrl(guid);
  if (fromGuidUrl) return fromGuidUrl;

  const fromLink = extractPostIdFromUrl(link);
  if (fromLink) return fromLink;

  return null;
}

function extractSubreddit(link) {
  if (!link) return null;
  const match = link.match(/\/r\/([^/]+)\/comments\//i);
  return match ? match[1] : null;
}

async function fetchRssFeed({ feedUrl, userAgent, timeoutMs = 15000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
    }

    const xml = await res.text();
    const parser = new Parser();
    return await parser.parseString(xml);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeFeedItems(feed) {
  const items = Array.isArray(feed?.items) ? feed.items : [];

  return items
    .map((item) => {
      const link = item.link || "";
      const guid = item.guid || item.id || "";

      const postId = extractPostId({ link, guid });
      const subreddit = extractSubreddit(link) || null;
      const title = item.title || "";

      const body = item.contentSnippet || item.content || item.summary || "";

      const publishedAt = unixSecondsFromDateString(
        item.isoDate || item.pubDate
      );

      return {
        postId,
        subreddit,
        title,
        link,
        body,
        publishedAt,
        raw: item,
      };
    })
    .filter((p) => !!p.postId);
}

module.exports = {
  fetchRssFeed,
  normalizeFeedItems,
  extractPostId,
  extractSubreddit,
};
