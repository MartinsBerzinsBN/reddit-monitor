<script setup>
const subredditInput = ref("");
const heuristicInput = ref("");
const saveError = ref("");
const saveSuccess = ref("");
const saving = ref(false);
const cronIngestEnabled = ref(true);

const { data, pending, refresh } = await useFetch("/api/settings");

const subredditList = computed(
  () => data.value?.settings?.subreddit_list || [],
);
const heuristicPatterns = computed(
  () => data.value?.settings?.heuristic_patterns || [],
);
const currentCronIngestEnabled = computed(
  () => data.value?.settings?.cron_ingest_enabled !== false,
);

watch(
  () => data.value?.settings?.cron_ingest_enabled,
  (value) => {
    cronIngestEnabled.value = value !== false;
  },
  { immediate: true },
);

async function saveSettings() {
  saveError.value = "";
  saveSuccess.value = "";
  saving.value = true;

  try {
    const nextSubreddits = subredditInput.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const nextPatterns = heuristicInput.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    await $fetch("/api/settings", {
      method: "POST",
      body: {
        subreddit_list: nextSubreddits.length
          ? nextSubreddits
          : subredditList.value,
        heuristic_patterns: nextPatterns.length
          ? nextPatterns
          : heuristicPatterns.value,
        cron_ingest_enabled: cronIngestEnabled.value,
      },
    });

    subredditInput.value = "";
    heuristicInput.value = "";
    saveSuccess.value = "Settings updated.";
    await refresh();
  } catch (error) {
    saveError.value =
      error.data.message || "Genering error message if .message is not passed.";
    console.error(error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white">
    <div class="mx-auto max-w-4xl px-6 py-10">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Settings</h1>
        <NuxtLink to="/" class="text-sm text-indigo-300 hover:text-indigo-200"
          >Back to dashboard</NuxtLink
        >
      </div>

      <div v-if="pending" class="mt-6 text-slate-300">Loading settings...</div>

      <section v-else class="mt-6 grid gap-6 md:grid-cols-2">
        <div class="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <h2 class="text-base font-semibold">Current subreddits</h2>
          <ul class="mt-3 space-y-2 text-sm text-slate-300">
            <li v-for="item in subredditList" :key="item">r/{{ item }}</li>
          </ul>
        </div>

        <div class="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <h2 class="text-base font-semibold">Current heuristic patterns</h2>
          <ul class="mt-3 space-y-2 text-sm text-slate-300">
            <li v-for="item in heuristicPatterns" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div
          class="rounded-xl border border-white/10 bg-slate-900/70 p-4 md:col-span-2"
        >
          <h2 class="text-base font-semibold">Scheduled ingestion (cron)</h2>
          <p class="mt-2 text-sm text-slate-300">
            Current status:
            <span
              class="font-medium"
              :class="
                currentCronIngestEnabled ? 'text-emerald-300' : 'text-amber-300'
              "
            >
              {{ currentCronIngestEnabled ? "Enabled" : "Disabled" }}
            </span>
          </p>
          <p class="mt-1 text-xs text-slate-400">
            This only affects automatic cron runs. Manual "Run ingest" still
            works.
          </p>
        </div>
      </section>

      <form
        class="mt-6 rounded-xl border border-white/10 bg-slate-900/70 p-4"
        @submit.prevent="saveSettings"
      >
        <h2 class="text-base font-semibold">Update settings</h2>

        <label class="mt-3 block text-sm">
          <span class="mb-1 block text-slate-300"
            >Subreddits (comma separated)</span
          >
          <input
            v-model="subredditInput"
            type="text"
            placeholder="SaaS, startups, marketing"
            class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
          />
        </label>

        <label class="mt-3 block text-sm">
          <span class="mb-1 block text-slate-300"
            >Heuristic patterns (comma separated)</span
          >
          <input
            v-model="heuristicInput"
            type="text"
            placeholder="how to, too expensive, wish there was"
            class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
          />
        </label>

        <div
          class="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
        >
          <div>
            <p class="text-slate-200">Enable scheduled cron ingest</p>
            <p class="text-xs text-slate-400">Automatic check for new posts</p>
          </div>

          <label class="relative inline-flex cursor-pointer items-center">
            <input
              v-model="cronIngestEnabled"
              type="checkbox"
              class="peer sr-only"
              :disabled="saving"
            />
            <span
              class="h-6 w-11 rounded-full bg-slate-700 transition-colors duration-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform after:duration-200 peer-checked:bg-indigo-500 peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
            />
          </label>
        </div>

        <p v-if="saveError" class="mt-3 text-sm text-rose-400">
          {{ saveError }}
        </p>
        <p v-if="saveSuccess" class="mt-3 text-sm text-emerald-400">
          {{ saveSuccess }}
        </p>

        <button
          :disabled="saving"
          class="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-70"
        >
          {{ saving ? "Saving..." : "Save settings" }}
        </button>
      </form>
    </div>
  </main>
</template>
