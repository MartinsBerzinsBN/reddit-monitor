<script setup>
const route = useRoute();

const { data, pending, error, refresh } = await useFetch(
  `/api/opportunities/${route.params.id}`,
);
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white">
    <div class="mx-auto max-w-4xl px-6 py-10">
      <NuxtLink to="/" class="text-sm text-indigo-300 hover:text-indigo-200"
        >← Back</NuxtLink
      >

      <div v-if="pending" class="mt-6 text-slate-300">
        Loading opportunity...
      </div>

      <div
        v-else-if="error"
        class="mt-6 rounded-xl border border-rose-500/40 bg-rose-950/40 p-4"
      >
        <p class="text-rose-300">
          {{ error.data?.message || "Failed to load opportunity." }}
        </p>
        <button
          class="mt-3 rounded-lg bg-rose-500 px-3 py-1.5 text-sm"
          @click="refresh()"
        >
          Retry
        </button>
      </div>

      <section v-else-if="data?.item" class="mt-6 space-y-6">
        <header>
          <h1 class="text-3xl font-semibold tracking-tight">
            {{ data.item.title }}
          </h1>
          <p class="mt-3 text-slate-300">{{ data.item.description }}</p>
        </header>

        <div class="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <h2 class="text-base font-semibold">Proposed solution</h2>
          <p class="mt-2 text-sm text-slate-300">
            {{ data.item.solution_idea }}
          </p>
        </div>

        <div>
          <h2 class="text-xl font-semibold">Evidence locker</h2>
          <div
            v-if="!data.evidence?.length"
            class="mt-3 text-sm text-slate-400"
          >
            No evidence posts linked yet.
          </div>

          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="post in data.evidence"
              :key="post.ID"
              class="rounded-xl border border-white/10 bg-slate-900/70 p-4"
            >
              <p class="text-xs uppercase tracking-wide text-slate-400">
                r/{{ post.subreddit || "unknown" }}
              </p>
              <h3 class="mt-1 text-sm font-semibold">{{ post.title }}</h3>
              <p class="mt-2 text-sm text-slate-300 line-clamp-3">
                {{ post.body }}
              </p>
              <a
                :href="post.url"
                target="_blank"
                rel="noreferrer"
                class="mt-3 inline-block text-sm text-indigo-300 hover:text-indigo-200"
              >
                Open Reddit thread
              </a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </main>
</template>
