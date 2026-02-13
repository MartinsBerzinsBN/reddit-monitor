export async function sendDiscordNewPostNotification({
  post,
  analysis,
  clusterId,
  clusterMode,
}) {
  const config = useRuntimeConfig();
  const webhookUrl =
    config.discordWebhookUrl || process.env.NUXT_DISCORD_WEBHOOK_URL || "";

  if (!webhookUrl) {
    return { sent: false, reason: "missing-webhook-url" };
  }

  const content = [
    "**New Opportunity Post Found**",
    `**Mode:** ${clusterMode === "new" ? "New cluster" : "Existing cluster"}`,
    `**Cluster ID:** ${clusterId}`,
    post?.subreddit ? `**Subreddit:** r/${post.subreddit}` : null,
    post?.title ? `**Title:** ${post.title}` : null,
    analysis?.pain_point_summary
      ? `**Pain point:** ${analysis.pain_point_summary}`
      : null,
    analysis?.proposed_solution
      ? `**Proposed solution:** ${analysis.proposed_solution}`
      : null,
    post?.link ? `**Link:** ${post.link}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Discord webhook failed: ${response.status} ${response.statusText}${
        body ? ` - ${body}` : ""
      }`,
    );
  }

  return { sent: true };
}
