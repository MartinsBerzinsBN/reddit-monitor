<script setup>
const newSubredditItem = ref("");
const newHeuristicItem = ref("");
const editableSubreddits = ref([]);
const editableHeuristicPatterns = ref([]);
const editingSubredditIndex = ref(-1);
const editingHeuristicIndex = ref(-1);
const subredditEditInput = ref("");
const heuristicEditInput = ref("");
const saveError = ref("");
const saveSuccess = ref("");
const saving = ref(false);
const cronIngestEnabled = ref(true);
const clusterDistanceThreshold = ref(0.65);

const { data, pending, refresh } = await useFetch("/api/settings");
const {
  data: linkQualityDebugData,
  pending: linkQualityDebugPending,
  refresh: refreshLinkQualityDebug,
  error: linkQualityDebugError,
} = await useFetch("/api/engine/link-quality-debug");

const currentCronIngestEnabled = computed(
  () => data.value?.settings?.cron_ingest_enabled !== false,
);
const currentClusterDistanceThreshold = computed(
  () => data.value?.settings?.cluster_distance_threshold ?? 0.65,
);
const linkQualityDebugSettings = computed(
  () => linkQualityDebugData.value?.settings || null,
);
const linkQualityDue = computed(() => linkQualityDebugData.value?.due || null);
const linkQualityRecentRuns = computed(
  () => linkQualityDebugData.value?.recentRuns || [],
);

watch(
  () => data.value?.settings?.cron_ingest_enabled,
  (value) => {
    cronIngestEnabled.value = value !== false;
  },
  { immediate: true },
);

watch(
  () => data.value?.settings?.cluster_distance_threshold,
  (value) => {
    const parsed = Number(value);
    clusterDistanceThreshold.value = Number.isFinite(parsed) ? parsed : 0.65;
  },
  { immediate: true },
);

watch(
  () => data.value?.settings?.subreddit_list,
  (value) => {
    editableSubreddits.value = Array.isArray(value) ? [...value] : [];
  },
  { immediate: true },
);

watch(
  () => data.value?.settings?.heuristic_patterns,
  (value) => {
    editableHeuristicPatterns.value = Array.isArray(value) ? [...value] : [];
  },
  { immediate: true },
);

function normalizeItem(value) {
  return String(value || "").trim();
}

function hasDuplicate(list, value, skipIndex = -1) {
  const normalized = normalizeItem(value).toLowerCase();
  return list.some((item, index) => {
    if (index === skipIndex) {
      return false;
    }

    return normalizeItem(item).toLowerCase() === normalized;
  });
}

async function commitSettings(successMessage = "Settings updated.") {
  if (!editableSubreddits.value.length) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "At least one subreddit is required.",
    });
  }

  if (!editableHeuristicPatterns.value.length) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "At least one heuristic pattern is required.",
    });
  }

  await $fetch("/api/settings", {
    method: "POST",
    body: {
      subreddit_list: editableSubreddits.value,
      heuristic_patterns: editableHeuristicPatterns.value,
      cron_ingest_enabled: cronIngestEnabled.value,
      cluster_distance_threshold: clusterDistanceThreshold.value,
    },
  });

  saveSuccess.value = successMessage;
  await refresh();
  await refreshLinkQualityDebug();
}

function formatDebugTimestamp(value) {
  const unix = Number(value);
  if (!Number.isFinite(unix) || unix <= 0) {
    return "—";
  }

  return new Date(unix * 1000).toLocaleString();
}

function formatDueInSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return "—";
  }

  if (seconds <= 0) {
    return "Due now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `In ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `In ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `In ${days}d`;
}

async function applyListChangeWithAutoSave(changeFn, successMessage) {
  const prevSubreddits = [...editableSubreddits.value];
  const prevHeuristicPatterns = [...editableHeuristicPatterns.value];

  saveError.value = "";
  saveSuccess.value = "";

  changeFn();
  saving.value = true;

  try {
    await commitSettings(successMessage);
  } catch (error) {
    editableSubreddits.value = prevSubreddits;
    editableHeuristicPatterns.value = prevHeuristicPatterns;
    saveError.value =
      error.data?.message ||
      error.message ||
      "Genering error message if .message is not passed.";
    console.error(error);
  } finally {
    saving.value = false;
  }
}

async function addSubreddit() {
  const value = normalizeItem(newSubredditItem.value);
  if (!value) {
    return;
  }

  if (hasDuplicate(editableSubreddits.value, value)) {
    saveError.value = "Subreddit already exists in the list.";
    return;
  }

  await applyListChangeWithAutoSave(() => {
    editableSubreddits.value.push(value);
    newSubredditItem.value = "";
  }, "Subreddit added.");
}

async function addHeuristicPattern() {
  const value = normalizeItem(newHeuristicItem.value);
  if (!value) {
    return;
  }

  if (hasDuplicate(editableHeuristicPatterns.value, value)) {
    saveError.value = "Heuristic pattern already exists in the list.";
    return;
  }

  await applyListChangeWithAutoSave(() => {
    editableHeuristicPatterns.value.push(value);
    newHeuristicItem.value = "";
  }, "Heuristic pattern added.");
}

function startEditSubreddit(index) {
  editingSubredditIndex.value = index;
  subredditEditInput.value = editableSubreddits.value[index] || "";
}

function startEditHeuristicPattern(index) {
  editingHeuristicIndex.value = index;
  heuristicEditInput.value = editableHeuristicPatterns.value[index] || "";
}

function cancelEditSubreddit() {
  editingSubredditIndex.value = -1;
  subredditEditInput.value = "";
}

function cancelEditHeuristicPattern() {
  editingHeuristicIndex.value = -1;
  heuristicEditInput.value = "";
}

async function saveEditSubreddit() {
  const index = editingSubredditIndex.value;
  if (index < 0) {
    return;
  }

  const value = normalizeItem(subredditEditInput.value);
  if (!value) {
    saveError.value = "Subreddit cannot be empty.";
    return;
  }

  if (hasDuplicate(editableSubreddits.value, value, index)) {
    saveError.value = "Subreddit already exists in the list.";
    return;
  }

  await applyListChangeWithAutoSave(() => {
    editableSubreddits.value.splice(index, 1, value);
    cancelEditSubreddit();
  }, "Subreddit updated.");
}

async function saveEditHeuristicPattern() {
  const index = editingHeuristicIndex.value;
  if (index < 0) {
    return;
  }

  const value = normalizeItem(heuristicEditInput.value);
  if (!value) {
    saveError.value = "Heuristic pattern cannot be empty.";
    return;
  }

  if (hasDuplicate(editableHeuristicPatterns.value, value, index)) {
    saveError.value = "Heuristic pattern already exists in the list.";
    return;
  }

  await applyListChangeWithAutoSave(() => {
    editableHeuristicPatterns.value.splice(index, 1, value);
    cancelEditHeuristicPattern();
  }, "Heuristic pattern updated.");
}

async function deleteSubreddit(index) {
  if (editableSubreddits.value.length <= 1) {
    saveError.value = "At least one subreddit is required.";
    return;
  }

  await applyListChangeWithAutoSave(() => {
    editableSubreddits.value.splice(index, 1);
    if (editingSubredditIndex.value === index) {
      cancelEditSubreddit();
    }
  }, "Subreddit deleted.");
}

async function deleteHeuristicPattern(index) {
  if (editableHeuristicPatterns.value.length <= 1) {
    saveError.value = "At least one heuristic pattern is required.";
    return;
  }

  await applyListChangeWithAutoSave(() => {
    editableHeuristicPatterns.value.splice(index, 1);
    if (editingHeuristicIndex.value === index) {
      cancelEditHeuristicPattern();
    }
  }, "Heuristic pattern deleted.");
}

async function saveSettings() {
  saveError.value = "";
  saveSuccess.value = "";
  saving.value = true;

  try {
    await commitSettings("Settings updated.");

    newSubredditItem.value = "";
    newHeuristicItem.value = "";
    cancelEditSubreddit();
    cancelEditHeuristicPattern();
  } catch (error) {
    saveError.value =
      error.data?.message ||
      error.message ||
      "Genering error message if .message is not passed.";
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
          <h2 class="text-base font-semibold">Subreddits</h2>
          <div class="mt-3 flex gap-2">
            <input
              v-model="newSubredditItem"
              type="text"
              placeholder="Add one subreddit"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              :disabled="saving"
              @keyup.enter="addSubreddit"
            />
            <button
              type="button"
              class="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold hover:bg-indigo-400 disabled:opacity-70"
              :disabled="saving"
              aria-label="Add subreddit"
              title="Add subreddit"
              @click="addSubreddit"
            >
              <Icon name="heroicons:plus-20-solid" class="h-4 w-4" />
            </button>
          </div>
          <ul class="mt-3 space-y-2 text-sm text-slate-300">
            <li
              v-for="(item, index) in editableSubreddits"
              :key="`${item}-${index}`"
              class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
            >
              <div
                v-if="editingSubredditIndex === index"
                class="flex items-center gap-2"
              >
                <input
                  v-model="subredditEditInput"
                  type="text"
                  class="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
                  :disabled="saving"
                  @keyup.enter="saveEditSubreddit"
                />
                <button
                  type="button"
                  class="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-70"
                  :disabled="saving"
                  @click="saveEditSubreddit"
                >
                  Save
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold hover:bg-slate-600 disabled:opacity-70"
                  :disabled="saving"
                  @click="cancelEditSubreddit"
                >
                  Cancel
                </button>
              </div>
              <div v-else class="flex items-center justify-between gap-2">
                <span>r/{{ item }}</span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold hover:bg-slate-600 disabled:opacity-70"
                    :disabled="saving"
                    aria-label="Edit subreddit"
                    title="Edit subreddit"
                    @click="startEditSubreddit(index)"
                  >
                    <Icon
                      name="heroicons:pencil-square-20-solid"
                      class="h-4 w-4"
                    />
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold hover:bg-rose-600 disabled:opacity-70"
                    :disabled="saving"
                    aria-label="Delete subreddit"
                    title="Delete subreddit"
                    @click="deleteSubreddit(index)"
                  >
                    <Icon name="heroicons:trash-20-solid" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div class="rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <h2 class="text-base font-semibold">Heuristic patterns</h2>
          <div class="mt-3 flex gap-2">
            <input
              v-model="newHeuristicItem"
              type="text"
              placeholder="Add one heuristic pattern"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              :disabled="saving"
              @keyup.enter="addHeuristicPattern"
            />
            <button
              type="button"
              class="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold hover:bg-indigo-400 disabled:opacity-70"
              :disabled="saving"
              aria-label="Add heuristic pattern"
              title="Add heuristic pattern"
              @click="addHeuristicPattern"
            >
              <Icon name="heroicons:plus-20-solid" class="h-4 w-4" />
            </button>
          </div>
          <ul class="mt-3 space-y-2 text-sm text-slate-300">
            <li
              v-for="(item, index) in editableHeuristicPatterns"
              :key="`${item}-${index}`"
              class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2"
            >
              <div
                v-if="editingHeuristicIndex === index"
                class="flex items-center gap-2"
              >
                <input
                  v-model="heuristicEditInput"
                  type="text"
                  class="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
                  :disabled="saving"
                  @keyup.enter="saveEditHeuristicPattern"
                />
                <button
                  type="button"
                  class="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-70"
                  :disabled="saving"
                  @click="saveEditHeuristicPattern"
                >
                  Save
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold hover:bg-slate-600 disabled:opacity-70"
                  :disabled="saving"
                  @click="cancelEditHeuristicPattern"
                >
                  Cancel
                </button>
              </div>
              <div v-else class="flex items-center justify-between gap-2">
                <span>{{ item }}</span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold hover:bg-slate-600 disabled:opacity-70"
                    :disabled="saving"
                    aria-label="Edit heuristic pattern"
                    title="Edit heuristic pattern"
                    @click="startEditHeuristicPattern(index)"
                  >
                    <Icon
                      name="heroicons:pencil-square-20-solid"
                      class="h-4 w-4"
                    />
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold hover:bg-rose-600 disabled:opacity-70"
                    :disabled="saving"
                    aria-label="Delete heuristic pattern"
                    title="Delete heuristic pattern"
                    @click="deleteHeuristicPattern(index)"
                  >
                    <Icon name="heroicons:trash-20-solid" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
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

        <div
          class="rounded-xl border border-white/10 bg-slate-900/70 p-4 md:col-span-2"
        >
          <h2 class="text-base font-semibold">Cluster threshold</h2>
          <p class="mt-2 text-sm text-slate-300">
            Current distance threshold:
            <span class="font-medium text-indigo-300">
              {{ currentClusterDistanceThreshold }}
            </span>
          </p>
          <p class="mt-1 text-xs text-slate-400">
            Lower values are stricter and create more new clusters.
          </p>
        </div>

        <div
          class="rounded-xl border border-white/10 bg-slate-900/70 p-4 md:col-span-2"
        >
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold">Link quality debug</h2>
            <button
              type="button"
              class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-600 disabled:opacity-70"
              :disabled="linkQualityDebugPending"
              @click="refreshLinkQualityDebug"
            >
              {{ linkQualityDebugPending ? "Refreshing..." : "Refresh" }}
            </button>
          </div>

          <p class="mt-2 text-xs text-slate-400">
            Preview of due checks and recent checker runs.
          </p>

          <p v-if="linkQualityDebugError" class="mt-3 text-sm text-rose-400">
            {{
              linkQualityDebugError?.data?.message ||
              linkQualityDebugError?.message ||
              "Failed to load link quality debug data."
            }}
          </p>

          <div
            v-else
            class="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3"
          >
            <div class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2">
              <p class="text-xs text-slate-400">Checker enabled</p>
              <p class="mt-1 font-medium">
                {{
                  linkQualityDebugSettings?.link_quality_check_enabled
                    ? "Yes"
                    : "No"
                }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2">
              <p class="text-xs text-slate-400">Batch size</p>
              <p class="mt-1 font-medium">
                {{ linkQualityDebugSettings?.link_quality_batch_size ?? "—" }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2">
              <p class="text-xs text-slate-400">Due now</p>
              <p class="mt-1 font-medium">
                {{ linkQualityDue?.dueNowCount ?? 0 }}
              </p>
            </div>
          </div>

          <div class="mt-4">
            <p class="text-sm font-medium text-slate-200">Upcoming due checks</p>
            <div
              v-if="!linkQualityDue?.items?.length"
              class="mt-2 text-xs text-slate-400"
            >
              No link checks scheduled.
            </div>
            <div v-else class="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10">
              <table class="min-w-full text-left text-xs">
                <thead class="bg-slate-900 text-slate-400">
                  <tr>
                    <th class="px-3 py-2 font-medium">Post</th>
                    <th class="px-3 py-2 font-medium">Stage</th>
                    <th class="px-3 py-2 font-medium">Next check</th>
                    <th class="px-3 py-2 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10 bg-slate-950 text-slate-300">
                  <tr v-for="item in linkQualityDue.items" :key="item.ID">
                    <td class="px-3 py-2">
                      <a
                        :href="item.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-indigo-300 hover:text-indigo-200"
                      >
                        {{ item.title || item.ID }}
                      </a>
                    </td>
                    <td class="px-3 py-2">{{ item.link_check_stage }}</td>
                    <td class="px-3 py-2">
                      {{ formatDebugTimestamp(item.link_next_check_at) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ formatDueInSeconds(item.due_in_seconds) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="mt-4">
            <p class="text-sm font-medium text-slate-200">Recent checker runs</p>
            <div
              v-if="!linkQualityRecentRuns.length"
              class="mt-2 text-xs text-slate-400"
            >
              No recent runs yet.
            </div>
            <div v-else class="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10">
              <table class="min-w-full text-left text-xs">
                <thead class="bg-slate-900 text-slate-400">
                  <tr>
                    <th class="px-3 py-2 font-medium">Finished</th>
                    <th class="px-3 py-2 font-medium">Status</th>
                    <th class="px-3 py-2 font-medium">Due</th>
                    <th class="px-3 py-2 font-medium">Active</th>
                    <th class="px-3 py-2 font-medium">Removed</th>
                    <th class="px-3 py-2 font-medium">Unknown</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10 bg-slate-950 text-slate-300">
                  <tr v-for="run in linkQualityRecentRuns" :key="run.ID">
                    <td class="px-3 py-2">
                      {{ formatDebugTimestamp(run.finished_at) }}
                    </td>
                    <td class="px-3 py-2">
                      {{ run.skipped ? "Skipped" : run.success ? "OK" : "Failed" }}
                    </td>
                    <td class="px-3 py-2">{{ run.total_due }}</td>
                    <td class="px-3 py-2">{{ run.active }}</td>
                    <td class="px-3 py-2">{{ run.removed_deleted }}</td>
                    <td class="px-3 py-2">{{ run.unknown_error }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <form
        class="mt-6 rounded-xl border border-white/10 bg-slate-900/70 p-4"
        @submit.prevent="saveSettings"
      >
        <h2 class="text-base font-semibold">Update settings</h2>

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

        <label class="mt-3 block text-sm">
          <span class="mb-1 block text-slate-300"
            >Cluster distance threshold</span
          >
          <input
            v-model.number="clusterDistanceThreshold"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.65"
            class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
          />
        </label>

        <p v-if="saveError" class="mt-3 text-sm text-rose-400">
          {{ saveError }}
        </p>
        <p v-if="saveSuccess" class="mt-3 text-sm text-emerald-400">
          {{ saveSuccess }}
        </p>

        <button
          :disabled="saving"
          class="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold hover:bg-indigo-400 disabled:opacity-70"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4" />
          {{ saving ? "Saving..." : "Save settings" }}
        </button>
      </form>
    </div>
  </main>
</template>
