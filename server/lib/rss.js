import Parser from "rss-parser";
import {
  DEFAULT_REDDIT_MAX_RETRIES,
  DEFAULT_REDDIT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./constants";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildFeedUrl(subreddits) {
  const cleaned = (subreddits || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!cleaned.length) {
    throw new Error("At least one subreddit is required.");
  }

  return `https://www.reddit.com/r/${cleaned.join("+")}/new/.rss`;
}

function unixSecondsFromDateString(value) {
  if (!value) {
    return null;
  }

  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return null;
  }

  return Math.floor(ms / 1000);
}

function extractPostIdFromUrl(url) {
  if (!url) {
    return null;
  }

  const commentsMatch = url.match(/\/comments\/([a-z0-9]+)\//i);
  if (commentsMatch) {
    return commentsMatch[1];
  }

  const shortLinkMatch = url.match(/redd\.it\/([a-z0-9]+)\/?$/i);
  if (shortLinkMatch) {
    return shortLinkMatch[1];
  }

  return null;
}

function extractPostId({ link, guid }) {
  const fromGuidThing = (guid || "").match(/\bt3_([a-z0-9]+)\b/i);
  if (fromGuidThing) {
    return fromGuidThing[1];
  }

  const fromGuidUrl = extractPostIdFromUrl(guid);
  if (fromGuidUrl) {
    return fromGuidUrl;
  }

  const fromLink = extractPostIdFromUrl(link);
  if (fromLink) {
    return fromLink;
  }

  return null;
}

function extractSubreddit(link) {
  if (!link) {
    return null;
  }

  const match = link.match(/\/r\/([^/]+)\/comments\//i);
  return match ? match[1] : null;
}

function normalizeSubreddit(subreddit) {
  return String(subreddit || "")
    .trim()
    .toLowerCase();
}

function parseRetryAfterSeconds(response) {
  const retryAfterHeader = response.headers.get("retry-after");
  const parsed = Number(retryAfterHeader);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return null;
}

export async function fetchRssFeed({
  subreddits,
  userAgent = DEFAULT_USER_AGENT,
  timeoutMs = DEFAULT_REDDIT_TIMEOUT_MS,
  retries = DEFAULT_REDDIT_MAX_RETRIES,
}) {
  const feedUrl = buildFeedUrl(subreddits);

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent,
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Reddit RSS error: ${response.status} ${response.statusText}`,
        );
      }

      const xml = await response.text();
      const parser = new Parser();
      return await parser.parseString(xml);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Failed to fetch Reddit RSS feed.");
}

export async function fetchSubredditNewListing({
  subreddit,
  limit = 50,
  userAgent = DEFAULT_USER_AGENT,
  timeoutMs = DEFAULT_REDDIT_TIMEOUT_MS,
  retries = DEFAULT_REDDIT_MAX_RETRIES,
}) {
  const normalizedSubreddit = normalizeSubreddit(subreddit);
  if (!normalizedSubreddit) {
    throw new Error("A subreddit is required.");
  }

  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(100, Math.max(1, Math.floor(Number(limit))))
    : 50;
  const endpoint = `https://www.reddit.com/r/${normalizedSubreddit}/new.json?raw_json=1&limit=${normalizedLimit}`;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        },
      });

      if (response.status === 429) {
        const retryAfterSeconds = parseRetryAfterSeconds(response);
        const waitMs = retryAfterSeconds
          ? retryAfterSeconds * 1000
          : 500 * Math.pow(2, attempt - 1);

        if (attempt < retries) {
          await sleep(waitMs);
          continue;
        }

        throw new Error(
          `Reddit listing rate limited for r/${normalizedSubreddit}`,
        );
      }

      if (!response.ok) {
        throw new Error(
          `Reddit listing error for r/${normalizedSubreddit}: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Failed to fetch Reddit listing.");
}

export function normalizeFeedItems(feed) {
  const items = Array.isArray(feed?.items) ? feed.items : [];

  return items
    .map((item) => {
      const link = item.link || "";
      const guid = item.guid || item.id || "";

      return {
        postId: extractPostId({ link, guid }),
        subreddit: extractSubreddit(link),
        title: item.title || "",
        body: item.contentSnippet || item.content || item.summary || "",
        link,
        publishedAt: unixSecondsFromDateString(item.isoDate || item.pubDate),
      };
    })
    .filter((item) => !!item.postId);
}

export function normalizeRedditListingItems(payload, { subreddit } = {}) {
  const defaultSubreddit = normalizeSubreddit(subreddit);
  const children = Array.isArray(payload?.data?.children)
    ? payload.data.children
    : [];

  return children
    .map((child) => {
      const data = child?.data || {};
      const postId = String(data.id || "").trim();
      const normalizedSubreddit =
        normalizeSubreddit(data.subreddit) || defaultSubreddit || null;
      const permalink = String(data.permalink || "").trim();
      const link = permalink
        ? `https://www.reddit.com${permalink}`
        : String(data.url || "").trim();
      const title = String(data.title || "").trim();
      const body = String(data.selftext || "").trim();
      const fullname = String(data.name || "").trim() || `t3_${postId}`;
      const createdAt = Number.isFinite(Number(data.created_utc))
        ? Math.floor(Number(data.created_utc))
        : null;

      return {
        postId,
        subreddit: normalizedSubreddit,
        title,
        body,
        link,
        fullname,
        publishedAt: createdAt,
      };
    })
    .filter((item) => !!item.postId);
}
