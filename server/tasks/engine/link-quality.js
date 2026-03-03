import { runLinkQualityChecks } from "../../lib/link-quality";

export default defineTask({
  meta: {
    name: "engine:link-quality",
    description:
      "Check analyzed Reddit links for removals and clean stale evidence posts.",
  },
  async run() {
    const result = await runLinkQualityChecks();

    return {
      result,
    };
  },
});
