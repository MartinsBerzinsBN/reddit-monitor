// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-02-12",
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      "*/5 * * * *": ["engine:ingest"],
    },
  },
  // Runtime config for environment variables
  runtimeConfig: {
    openaiApiKey: "", // can be overridden by NUXT_OPENAI_API_KEY environment variable
    discordWebhookUrl: "", // can be overridden by NUXT_DISCORD_WEBHOOK_URL environment variable
  },
  modules: [
    "@nuxt/fonts",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxtjs/tailwindcss",
    "nuxt-auth-utils",
  ],
  routeRules: {
    "/**": {
      headers: {
        "X-Robots-Tag":
          "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate",
      },
    },
  },
});
