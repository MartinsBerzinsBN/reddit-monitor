export default defineNitroConfig({
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    "*/20 * * * *": ["engine:ingest"],
  },
});
