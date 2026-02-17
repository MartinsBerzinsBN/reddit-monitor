<script setup>
const route = useRoute();
const deletingPostId = ref(null);
const deleteError = ref("");
const deleteSuccess = ref("");

const { data, pending, error, refresh } = await useFetch(
  `/api/opportunities/${route.params.id}`,
);

async function deleteEvidencePost(postId) {
  if (!postId || deletingPostId.value) {
    return;
  }

  if (
    import.meta.client &&
    !window.confirm("Delete this evidence post from the database?")
  ) {
    return;
  }

  deleteError.value = "";
  deleteSuccess.value = "";
  deletingPostId.value = postId;

  try {
    const response = await $fetch(
      `/api/opportunities/${route.params.id}/posts/${postId}`,
      {
        method: "DELETE",
      },
    );

    if (response?.clusterRemoved) {
      await navigateTo("/");
      return;
    }

    deleteSuccess.value = "Post deleted.";
    await refresh();
  } catch (error) {
    deleteError.value =
      error.data.message || "Genering error message if .message is not passed.";
    console.error(error);
  } finally {
    deletingPostId.value = null;
  }
}
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
        </header>

        <div class="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <h2 class="text-base font-semibold">Pain Point</h2>
          <p class="mt-2 text-sm text-slate-300">
            {{ data.item.description }}
          </p>
        </div>

        <div class="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <h2 class="text-base font-semibold">Proposed solution</h2>
          <p class="mt-2 text-sm text-slate-300">
            {{ data.item.solution_idea }}
          </p>
        </div>

        <div>
          <h2 class="text-xl font-semibold">Evidence locker</h2>
          <p v-if="deleteError" class="mt-2 text-sm text-rose-400">
            {{ deleteError }}
          </p>
          <p v-if="deleteSuccess" class="mt-2 text-sm text-emerald-400">
            {{ deleteSuccess }}
          </p>
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

              <div class="mt-3 flex items-center gap-4">
                <a
                  :href="post.url"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-block text-sm text-indigo-300 hover:text-indigo-200"
                >
                  Open Reddit thread
                </a>

                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-70"
                  :disabled="deletingPostId !== null"
                  aria-label="Delete evidence post"
                  title="Delete evidence post"
                  @click="deleteEvidencePost(post.ID)"
                >
                  <Icon name="heroicons:trash-20-solid" class="h-4 w-4" />
                  {{ deletingPostId === post.ID ? "Deleting..." : "Delete" }}
                </button>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </main>
</template>
