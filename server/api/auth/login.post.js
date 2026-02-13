import { getUserByEmail } from "../../lib/sqlite-helpers";

export default defineEventHandler(async (event) => {
  try {
    const { email, password } = await readBody(event);
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const plainPassword = String(password || "");

    if (!email || !password) {
      throw createError({
        status: 400,
        statusText: "Bad Request",
        message: "Email and password are required.",
      });
    }

    const user = getUserByEmail(normalizedEmail);

    if (!user) {
      throw createError({
        status: 401,
        statusText: "Unauthorized",
        message: "Invalid email or password.",
      });
    }

    const isValidPassword = await verifyPassword(
      user.password_hash,
      plainPassword,
    );
    if (!isValidPassword) {
      throw createError({
        status: 401,
        statusText: "Unauthorized",
        message: "Invalid email or password.",
      });
    }

    const userSessionData = {
      userId: user.ID,
      username: user.username,
      email: user.email,
    };

    await setUserSession(event, { user: userSessionData });

    return { user: userSessionData };
  } catch (error) {
    console.error("Error during login:", error);
    if (error.statusCode || error.status) {
      throw error;
    }
    throw createError({
      status: 500,
      statusText: "Internal Server Error",
      message: "An unexpected error occurred during login.",
    });
  }
});
