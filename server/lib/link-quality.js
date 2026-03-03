import {
  DEFAULT_REDDIT_MAX_RETRIES,
  DEFAULT_REDDIT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from "./constants";
import { fetchRssFeed, normalizeFeedItems } from "./rss";
import {
  createLinkQualityRun,
  deletePostById,
  getIngestSettings,
  listDueLinkCheckPosts,
  markLinkCheckActive,
  markLinkCheckUnknownError,
} from "./sqlite-helpers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPostStatusFromReddit({
  postId,
  userAgent = DEFAULT_USER_AGENT,
  timeoutMs = DEFAULT_REDDIT_TIMEOUT_MS,
  retries = DEFAULT_REDDIT_MAX_RETRIES,
}) {
  const endpoint = `https://www.reddit.com/comments/${postId}/.json?raw_json=1&limit=1`;
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

      if (response.status === 404 || response.status === 410) {
        return { status: "removed", reason: `http_${response.status}` };
      }

      if (response.status === 403) {
        return { status: "unknown_error", reason: "http_403" };
      }

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Reddit status endpoint error: ${response.status}`);
      }

      if (!response.ok) {
        return {
          status: "unknown_error",
          reason: `http_${response.status}`,
        };
      }

      const payload = await response.json();
      const postData = payload?.[0]?.data?.children?.[0]?.data;

      if (!postData) {
        return { status: "removed", reason: "missing_post_data" };
      }

      if (postData.removed_by_category) {
        return {
          status: "removed",
          reason: `removed_by_${postData.removed_by_category}`,
        };
      }

      const title = String(postData.title || "")
        .trim()
        .toLowerCase();
      const selfText = String(postData.selftext || "")
        .trim()
        .toLowerCase();
      const author = String(postData.author || "")
        .trim()
        .toLowerCase();

      if (title === "[removed]" || selfText === "[removed]") {
        return { status: "removed", reason: "content_removed" };
      }

      if (author === "[deleted]" && selfText === "[deleted]") {
        return { status: "removed", reason: "author_deleted" };
      }

      return { status: "active", reason: "post_visible" };
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

  return {
    status: "unknown_error",
    reason: lastError?.message || "status_request_failed",
  };
}

async function fetchRssPresenceMap(subreddits) {
  if (!Array.isArray(subreddits) || !subreddits.length) {
    return new Set();
  }

  const feed = await fetchRssFeed({
    subreddits,
    userAgent: DEFAULT_USER_AGENT,
  });
  const items = normalizeFeedItems(feed);
  return new Set(items.map((item) => item.postId).filter(Boolean));
}

export async function runLinkQualityChecks() {
  const startedAt = Math.floor(Date.now() / 1000);
  const settings = getIngestSettings();

  if (!settings.link_quality_check_enabled) {
    const result = {
      success: true,
      skipped: true,
      message: "Scheduled link quality checks are disabled in settings.",
      stats: null,
    };

    createLinkQualityRun({
      startedAt,
      finishedAt: Math.floor(Date.now() / 1000),
      success: true,
      skipped: true,
      message: result.message,
      stats: {},
    });

    return result;
  }

  const now = Math.floor(Date.now() / 1000);
  const duePosts = listDueLinkCheckPosts({
    now,
    limit: settings.link_quality_batch_size,
  });

  const stats = {
    totalDue: duePosts.length,
    active: 0,
    unknownError: 0,
    removedDeleted: 0,
    rssHits: 0,
    directChecks: 0,
  };

  if (!duePosts.length) {
    const result = {
      success: true,
      skipped: true,
      message: "No due Reddit links to check.",
      stats,
    };

    createLinkQualityRun({
      startedAt,
      finishedAt: Math.floor(Date.now() / 1000),
      success: true,
      skipped: true,
      message: result.message,
      stats,
    });

    return result;
  }

  let rssPresentPostIds = null;
  try {
    const subreddits = [
      ...new Set(duePosts.map((post) => post.subreddit).filter(Boolean)),
    ];
    rssPresentPostIds = await fetchRssPresenceMap(subreddits);
  } catch (error) {
    rssPresentPostIds = null;
    console.error("[link-quality] rss hint fetch failed", error);
  }

  for (const post of duePosts) {
    const checkedAt = Math.floor(Date.now() / 1000);

    if (rssPresentPostIds?.has(post.ID)) {
      markLinkCheckActive({ postId: post.ID, checkedAt });
      stats.active += 1;
      stats.rssHits += 1;
      continue;
    }

    stats.directChecks += 1;
    const check = await fetchPostStatusFromReddit({ postId: post.ID });

    if (check.status === "active") {
      markLinkCheckActive({ postId: post.ID, checkedAt });
      stats.active += 1;
      continue;
    }

    if (check.status === "removed") {
      const deletion = deletePostById(post.ID);
      if (deletion.deleted) {
        stats.removedDeleted += 1;
      } else {
        markLinkCheckUnknownError({ postId: post.ID, checkedAt });
        stats.unknownError += 1;
      }
      continue;
    }

    markLinkCheckUnknownError({ postId: post.ID, checkedAt });
    stats.unknownError += 1;
  }

  const result = {
    success: true,
    skipped: false,
    message: "Link quality checks completed.",
    stats,
  };

  createLinkQualityRun({
    startedAt,
    finishedAt: Math.floor(Date.now() / 1000),
    success: true,
    skipped: false,
    message: result.message,
    stats,
  });

  return result;
}
