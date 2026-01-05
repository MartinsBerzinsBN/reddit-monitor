async function sendDiscordWebhook({
  webhookUrl,
  keyword,
  subreddit,
  title,
  link,
}) {
  const content = `**New Lead Found!** [Keyword: ${keyword}]\n**Sub:** r/${subreddit}\n**Title:** ${title}\n**Link:** ${link}`;

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
