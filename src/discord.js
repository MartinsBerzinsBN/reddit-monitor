async function sendDiscordWebhook({
  webhookUrl,
  taskName,
  keyword,
  subreddit,
  title,
  link,
}) {
  const content = [
    `**New Lead Found!** [Keyword: ${keyword}]`,
    taskName ? `**Business:** ${taskName}` : null,
    `**Sub:** r/${subreddit}`,
    `**Title:** ${title}`,
    `**Link:** ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Discord webhook failed: ${res.status} ${res.statusText}${
        body ? ` - ${body}` : ""
      }`
    );
  }
}

module.exports = { sendDiscordWebhook };
