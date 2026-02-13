const PUBLIC_API_PATHS = [
  /^\/api\/auth\//,
  /^\/api\/_auth(?:$|\/)/,
  /^\/api\/up(?:$|\/)/,
];

export default defineEventHandler(async (event) => {
  const path = event.node.req.url || "/";

  if (!path.startsWith("/api/")) {
    return;
  }

  if (PUBLIC_API_PATHS.some((pattern) => pattern.test(path))) {
    return;
  }

  try {
    const session = await requireUserSession(event);
    if (!session?.user?.userId) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
        message: "Authentication required.",
      });
    }

    event.context.auth = {
      userId: session.user.userId,
      session,
    };
  } catch (error) {
    console.warn(
      "[AuthMiddleware] Blocked request",
      path,
      error?.statusCode || error?.message,
    );

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Authentication required.",
    });
  }
});
