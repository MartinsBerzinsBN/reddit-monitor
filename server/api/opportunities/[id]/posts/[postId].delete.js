import { deletePostFromCluster } from "../../../../lib/sqlite-helpers";

export default defineEventHandler((event) => {
  const clusterId = getRouterParam(event, "id");
  const postId = getRouterParam(event, "postId");

  if (!clusterId || !postId) {
    throw createError({
      status: 400,
      statusText: "Bad Request",
      message: "Cluster ID and Post ID are required.",
    });
  }

  const result = deletePostFromCluster({ clusterId, postId });

  if (!result?.deleted) {
    throw createError({
      status: 404,
      statusText: "Not Found",
      message: "Post not found for this opportunity.",
    });
  }

  return {
    success: true,
    clusterRemoved: result.clusterRemoved === true,
  };
});
