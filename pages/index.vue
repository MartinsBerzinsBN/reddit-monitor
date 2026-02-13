<script setup>
const sort = ref("demand");
const running = ref(false);
const runError = ref("");
const runSuccess = ref("");

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
      </div>

      <p v-if="runError" class="mt-3 text-sm text-rose-400">{{ runError }}</p>
      <p v-if="runSuccess" class="mt-3 text-sm text-emerald-400">
        {{ runSuccess }}
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
  </main>
</template>
