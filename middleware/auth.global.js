const publicPaths = ["/login", "/register"];

export default defineNuxtRouteMiddleware(async (to) => {
  const session = useUserSession();

  if (!session.ready.value) {
    await session.fetch();
  }

  const isPublicRoute = publicPaths.some((path) => to.path.startsWith(path));

  if (isPublicRoute) {
    if (session.loggedIn.value && session.user.value) {
      const defaultRoute = "/";
      if (defaultRoute !== to.path) {
        return navigateTo(defaultRoute);
      }
    }
    return;
  }

  if (!session.loggedIn.value || !session.user.value) {
    return navigateTo("/login");
  }

  return;
});
