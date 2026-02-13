export default defineEventHandler(async (event) => {
  try {
    await clearUserSession(event);
    // Optional: You can return a success message or status
    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Error during logout:", error);
    throw createError({
      status: 500,
      statusText: "Internal Server Error",
      message: "An unexpected error occurred during logout.",
    });
  }
});
