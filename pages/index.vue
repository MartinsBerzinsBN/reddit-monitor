<script setup>
const sort = ref("demand");
const running = ref(false);
const rerunning = ref(false);
const runError = ref("");
const runSuccess = ref("");
const rerunError = ref("");
const rerunSuccess = ref("");
const exportError = ref("");
const exportSuccess = ref("");
const rerunProgress = ref({
  status: "idle",
  active: false,
  total: 0,
  processed: 0,
  percent: 0,
  message: "",
  error: null,
});

let rerunProgressTimer = null;

const rerunPercent = computed(() => {
  return Math.max(0, Math.min(100, Number(rerunProgress.value?.percent) || 0));
});

const showRerunOverlay = computed(() => {
  return rerunning.value || rerunProgress.value?.status === "running";
});

const { data, pending, error, refresh } = await useFetch("/api/opportunities", {
  query: {
    sort,
  },
});

async function runEngine() {
  runError.value = "";
  runSuccess.value = "";
  running.value = true;

  try {
    const response = await $fetch("/api/engine/run", {
      method: "POST",
    });

    runSuccess.value = `Run complete. New: ${response.stats.clusteredNew}, Matched: ${response.stats.clusteredExisting}`;
    await refresh();
  } catch (error) {
    runError.value =
      error.data.message || "Genering error message if .message is not passed.";
    console.error(error);
  } finally {
    running.value = false;
  }
}

async function fetchRerunProgress() {
  try {
    rerunProgress.value = await $fetch("/api/engine/reanalyze-progress");
  } catch (error) {
    console.error(error);
  }
}

function startRerunProgressPolling() {
  stopRerunProgressPolling();
  fetchRerunProgress();
  rerunProgressTimer = setInterval(fetchRerunProgress, 1000);
}

function stopRerunProgressPolling() {
  if (rerunProgressTimer) {
    clearInterval(rerunProgressTimer);
    rerunProgressTimer = null;
  }
}

async function rerunAnalysis() {
  rerunError.value = "";
  rerunSuccess.value = "";
  rerunning.value = true;
  startRerunProgressPolling();

  try {
    const response = await $fetch("/api/engine/reanalyze", {
      method: "POST",
    });

    rerunSuccess.value = `Re-analysis complete. New: ${response.stats.clusteredNew}, Matched: ${response.stats.clusteredExisting}, Skipped: ${response.stats.skipped}`;
    await refresh();
  } catch (error) {
    rerunError.value =
      error.data.message || "Genering error message if .message is not passed.";
    console.error(error);
  } finally {
    await fetchRerunProgress();
    stopRerunProgressPolling();
    rerunning.value = false;
  }
}

onBeforeUnmount(() => {
  stopRerunProgressPolling();
});

function downloadOpportunitiesMarkdown() {
  exportError.value = "";
  exportSuccess.value = "";

  const items = data.value?.items || [];
  if (!items.length) {
    exportError.value = "No opportunities available to export.";
    return;
  }

  const markdown = [
    "# Opportunities export",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    ...items.flatMap((item, index) => [
      `## ${index + 1}. ${item.title || "Untitled opportunity"}`,
      "",
      "### Reddit text",
      item.description || "No Reddit text available.",
      "",
      "### AI idea",
      item.solution_idea || "No AI idea available.",
      "",
    ]),
  ].join("\n");

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const link = document.createElement("a");

  link.href = url;
  link.download = `opportunities-${timestamp}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  exportSuccess.value = "Markdown export downloaded.";
}

async function logout() {
  await $fetch("/api/auth/logout", { method: "POST" });
  await navigateTo("/login");
}
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">
            Market Validator
          </h1>
          <p class="mt-1 text-sm text-slate-400">Opportunity dashboard</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <NuxtLink
            to="/settings"
            class="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Settings
          </NuxtLink>
          <button
            class="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            @click="logout"
          >
            Logout
          </button>
        </div>
      </header>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <label class="text-sm text-slate-300">
          Sort:
          <select
            v-model="sort"
            class="ml-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm"
            @change="refresh"
          >
            <option value="demand">High demand</option>
            <option value="fresh">Fresh</option>
          </select>
        </label>

        <button
          :disabled="running"
          class="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-70"
          @click="runEngine"
        >
          {{ running ? "Running..." : "Run ingest" }}
        </button>

        <button
          :disabled="rerunning"
          class="rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold hover:bg-violet-400 disabled:opacity-70"
          @click="rerunAnalysis"
        >
          {{ rerunning ? "Re-analyzing..." : "Re-run analysis" }}
        </button>

        <button
          :disabled="pending || !data?.items?.length"
          class="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-70"
          @click="downloadOpportunitiesMarkdown"
        >
          Download .md
        </button>
      </div>

      <p v-if="runError" class="mt-3 text-sm text-rose-400">{{ runError }}</p>
      <p v-if="runSuccess" class="mt-3 text-sm text-emerald-400">
        {{ runSuccess }}
      </p>
      <p v-if="rerunError" class="mt-2 text-sm text-rose-400">
        {{ rerunError }}
      </p>
      <p v-if="rerunSuccess" class="mt-2 text-sm text-emerald-400">
        {{ rerunSuccess }}
      </p>
      <p
        v-if="
          !rerunning && rerunProgress.status === 'failed' && rerunProgress.error
        "
        class="mt-2 text-sm text-rose-400"
      >
        {{ rerunProgress.error }}
      </p>
      <p v-if="exportError" class="mt-2 text-sm text-rose-400">
        {{ exportError }}
      </p>
      <p v-if="exportSuccess" class="mt-2 text-sm text-emerald-400">
        {{ exportSuccess }}
      </p>

      <div v-if="pending" class="mt-8 text-slate-300">
        Loading opportunities...
      </div>

      <div
        v-else-if="error"
        class="mt-8 rounded-xl border border-rose-500/40 bg-rose-950/40 p-4"
      >
        <p class="text-rose-300">
          {{ error.data?.message || "Failed to load opportunities." }}
        </p>
      </div>

      <section
        v-else-if="!data?.items?.length"
        class="mt-8 rounded-xl border border-dashed border-white/20 bg-slate-900/40 p-8 text-center"
      >
        <h2 class="text-lg font-semibold">No opportunities yet</h2>
        <p class="mt-2 text-sm text-slate-400">
          Run ingestion to populate the first clusters.
        </p>
      </section>

      <section v-else class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="item in data.items"
          :key="item.ID"
          :to="`/opportunity/${item.ID}`"
          class="rounded-xl border border-white/10 bg-slate-900/70 p-4 transition hover:border-indigo-400/50"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-wide text-slate-400">
              Signal strength
            </p>
            <span
              class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200"
            >
              {{ item.post_count }}
            </span>
          </div>

          <h2 class="mt-2 line-clamp-2 text-base font-semibold">
            {{ item.title }}
          </h2>
          <p class="mt-2 line-clamp-3 text-sm text-slate-300">
            {{ item.description }}
          </p>

          <div class="mt-3 flex flex-wrap gap-1">
            <span
              v-for="source in item.subreddit_sources"
              :key="source"
              class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-200"
            >
              r/{{ source }}
            </span>
          </div>
        </NuxtLink>
      </section>
    </div>

    <div
      v-if="showRerunOverlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div
        class="w-full max-w-md rounded-xl border border-white/20 bg-slate-900 p-5"
      >
        <div class="flex items-center gap-2">
          <span
            class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-transparent"
          />
          <p class="text-base font-semibold text-white">Re-analyzing posts</p>
        </div>
        <p class="mt-1 text-sm text-slate-300">
          {{ rerunProgress.message || "Processing existing Reddit posts..." }}
        </p>

        <div class="mt-4 h-2 w-full rounded-full bg-white/10">
          <div
            class="h-2 rounded-full bg-violet-400 transition-all duration-300"
            :style="{ width: `${rerunPercent}%` }"
          />
        </div>

        <p class="mt-2 text-xs text-slate-300">
          {{ rerunPercent }}% · {{ rerunProgress.processed || 0 }}/{{
            rerunProgress.total || 0
          }}
        </p>
      </div>
    </div>
  </main>
</template>
