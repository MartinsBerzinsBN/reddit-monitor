import OpenAI from "openai";
import { z } from "zod";

const analysisSchema = z.object({
  is_opportunity: z.boolean(),
  pain_point_summary: z.string().min(1),
  proposed_solution: z.string().min(1),
});

let openaiClient;

function getClient() {
  if (!openaiClient) {
    const config = useRuntimeConfig();
    const apiKey =
      config.openaiApiKey ||
      process.env.NUXT_OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "";

    if (!apiKey) {
      throw new Error("Missing OpenAI API key.");
    }

    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function analyzePost(title, body) {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: "gpt-5-nano",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a Product Manager. Analyze this Reddit post. Return strict JSON with keys: is_opportunity (boolean), pain_point_summary (string), proposed_solution (string).",
      },
      {
        role: "user",
        content: `Title: ${title || ""}\n\nBody: ${body || ""}`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI did not return analysis content.");
  }

  const parsed = JSON.parse(raw);
  return analysisSchema.parse(parsed);
}

export async function getEmbedding(text) {
  const client = getClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error("Unexpected embedding format.");
  }

  return embedding;
}
