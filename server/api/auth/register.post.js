import { createUser, getUserByEmail } from "../../lib/sqlite-helpers";
import { generateUUID } from "../../lib/uuid";

const ALLOWED_REGISTRATION_EMAIL = "martins@bnsystems.lv";

export default defineEventHandler(async (event) => {
  try {
    const { username, email, password } = await readBody(event);
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!username || !email || !password) {
      throw createError({
        status: 400,
        statusText: "Bad Request",
        message: "Username, email, and password are required.",
      });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw createError({
        status: 400,
        statusText: "Bad Request",
        message: "Invalid email format.",
      });
    }

    if (normalizedEmail !== ALLOWED_REGISTRATION_EMAIL) {
      throw createError({
        status: 403,
        statusText: "Forbidden",
        message: "Registration is closed.",
      });
    }

    if (password.length < 8) {
      throw createError({
        status: 400,
        statusText: "Bad Request",
        message: "Password must be at least 8 characters long.",
      });
    }

    const existingUser = getUserByEmail(normalizedEmail);

    if (existingUser) {
      throw createError({
        status: 409,
        statusText: "Conflict",
        message: "User with this email already exists.",
      });
    }

    const hashedPassword = await hashPassword(password);
    const userId = generateUUID();

    createUser({
      ID: userId,
      email: normalizedEmail,
      username,
      passwordHash: hashedPassword,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const newUser = {
      userId,
      username,
      email: normalizedEmail,
    };

    await setUserSession(event, { user: newUser });

    return { user: newUser };
  } catch (error) {
    console.error("Error during registration:", error);
    if (error.statusCode || error.status) {
      throw error;
    }
    throw createError({
      status: 500,
      statusText: "Internal Server Error",
      message: "An unexpected error occurred during registration.",
    });
  }
});
