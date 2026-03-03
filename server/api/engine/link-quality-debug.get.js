import {
  getIngestSettings,
  listDueLinkChecksDebug,
  listRecentLinkQualityRuns,
} from "../../lib/sqlite-helpers";

export default defineEventHandler((event) => {
  const query = getQuery(event);

  const now = Math.floor(Date.now() / 1000);
  const dueLimitRaw = Number(query?.due_limit ?? 50);
  const runsLimitRaw = Number(query?.runs_limit ?? 20);

  const dueLimit =
    Number.isFinite(dueLimitRaw) && dueLimitRaw > 0
      ? Math.floor(dueLimitRaw)
      : 50;
  const runsLimit =
    Number.isFinite(runsLimitRaw) && runsLimitRaw > 0
      ? Math.floor(runsLimitRaw)
      : 20;

  const settings = getIngestSettings();
  const dueChecks = listDueLinkChecksDebug({ now, limit: dueLimit });
  const recentRuns = listRecentLinkQualityRuns({ limit: runsLimit });

  const dueNowCount = dueChecks.filter(
    (item) => Number(item.link_next_check_at) <= now,
  ).length;

  return {
    now,
    settings: {
      link_quality_check_enabled: settings.link_quality_check_enabled,
      link_quality_batch_size: settings.link_quality_batch_size,
    },
    due: {
      totalInWindow: dueChecks.length,
      dueNowCount,
      items: dueChecks,
    },
    recentRuns,
  };
});
