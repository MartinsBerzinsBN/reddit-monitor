import { getIngestSettings } from "../../lib/sqlite-helpers";

export default defineEventHandler(() => {
  const settings = getIngestSettings();
  return { settings };
});
