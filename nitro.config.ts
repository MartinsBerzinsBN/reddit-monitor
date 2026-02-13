export default defineNitroConfig({
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    "*/5 * * * *": ["engine:ingest"],
  },
});
