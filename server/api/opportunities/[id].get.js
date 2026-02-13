import {
  getOpportunityById,
  getPostsByClusterId,
} from "../../lib/sqlite-helpers";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "Opportunity ID is required.",
    });
  }

  const item = getOpportunityById(id);
  if (!item) {
    throw createError({
      status: 404,
      statusText: "Not Found",
      message: "Opportunity not found.",
    });
  }

  const evidence = getPostsByClusterId(id);
  return { item, evidence };
});
