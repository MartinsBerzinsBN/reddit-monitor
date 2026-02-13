<script setup>
const username = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const usernameTouched = ref(false);
const loading = ref(false);
const registerError = ref("");
const session = useUserSession();

const passwordMismatch = computed(
  () =>
    !!password.value &&
    !!confirmPassword.value &&
    password.value !== confirmPassword.value,
);

function getUsernameFromEmail(value) {
  return (
    String(value || "")
      .split("@")[0]
      ?.trim() || ""
  );
}

function handleEmailInput() {
  if (!usernameTouched.value) {
    username.value = getUsernameFromEmail(email.value);
  }
}

function handleUsernameInput() {
  usernameTouched.value = true;
}

async function handleSubmit() {
  registerError.value = "";

  if (password.value !== confirmPassword.value) {
    registerError.value = "Passwords do not match.";
    return;
  }

  loading.value = true;

  try {
    await $fetch("/api/auth/register", {
      method: "POST",
      body: {
        username: username.value,
        email: email.value,
        password: password.value,
      },
    });

    await session.fetch();
    await navigateTo("/");
  } catch (error) {
    registerError.value =
      error?.data?.message ||
      "Genering error message if .message is not passed.";
    console.error(error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-950 text-white">
    <div
      class="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10"
    >
      <div
        class="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl"
      >
        <h1 class="text-2xl font-semibold tracking-tight">Create account</h1>
        <p class="mt-2 text-sm text-slate-400">Market Validator Dashboard</p>

        <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
          <label class="block text-sm">
            <span class="mb-1 block text-slate-300">Email</span>
            <input
              v-model="email"
              type="email"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              @input="handleEmailInput"
              required
            />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-slate-300">Username</span>
            <input
              v-model="username"
              type="text"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              @input="handleUsernameInput"
              required
            />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-slate-300">Password</span>
            <input
              v-model="password"
              type="password"
              minlength="8"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              required
            />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-slate-300">Confirm password</span>
            <input
              v-model="confirmPassword"
              type="password"
              minlength="8"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              required
            />
          </label>

          <p v-if="passwordMismatch" class="text-sm text-rose-400">
            Passwords do not match.
          </p>

          <p v-if="registerError" class="text-sm text-rose-400">
            {{ registerError }}
          </p>

          <button
            type="submit"
            :disabled="loading || passwordMismatch"
            class="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-70"
          >
            {{ loading ? "Creating account..." : "Create account" }}
          </button>

          <p class="text-center text-sm text-slate-400">
            Already have an account?
            <NuxtLink to="/login" class="text-indigo-300 hover:text-indigo-200">
              Sign in
            </NuxtLink>
          </p>
        </form>
      </div>
    </div>
  </main>
</template>
