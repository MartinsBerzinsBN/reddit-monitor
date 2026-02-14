const initialState = {
  status: "idle",
  active: false,
  total: 0,
  processed: 0,
  percent: 0,
  message: "",
  error: null,
  startedAt: null,
  finishedAt: null,
};

const state = globalThis.__reanalyzeProgressState || { ...initialState };
globalThis.__reanalyzeProgressState = state;

function percentFrom(total, processed, status) {
  if (status === "done") {
    return 100;
  }

  if (!total) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

export function startReanalyzeProgress(total) {
  state.status = "running";
  state.active = true;
  state.total = Number(total) || 0;
  state.processed = 0;
  state.percent = 0;
  state.message = "Starting re-analysis...";
  state.error = null;
  state.startedAt = Date.now();
  state.finishedAt = null;
}

export function updateReanalyzeProgress({ processed, message = "" }) {
  state.processed = Math.min(state.total, Math.max(0, Number(processed) || 0));
  state.percent = percentFrom(state.total, state.processed, state.status);
  state.message = message;
}

export function completeReanalyzeProgress(stats) {
  state.status = "done";
  state.active = false;
  state.processed = state.total;
  state.percent = 100;
  state.message = "Re-analysis completed.";
  state.error = null;
  state.finishedAt = Date.now();
  state.stats = stats || null;
}

export function failReanalyzeProgress(error) {
  state.status = "failed";
  state.active = false;
  state.percent = percentFrom(state.total, state.processed, state.status);
  state.message = "Re-analysis failed.";
  state.error = error?.message || "Failed to re-run analysis.";
  state.finishedAt = Date.now();
}

export function getReanalyzeProgress() {
  return {
    ...state,
  };
}
