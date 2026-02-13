import { listOpportunities } from "../../lib/sqlite-helpers";

const allowedSort = new Set(["demand", "fresh"]);

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const sort = String(query.sort || "demand");

  if (!allowedSort.has(sort)) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "Invalid sort option.",
    });
  }

  const items = listOpportunities({ sort });
  return { items, sort };
});
