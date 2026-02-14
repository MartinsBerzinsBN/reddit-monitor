import { getReanalyzeProgress } from "../../lib/reanalyze-progress";

export default defineEventHandler(() => {
  return getReanalyzeProgress();
});
