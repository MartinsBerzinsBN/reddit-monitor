<script setup>
const email = ref("");
const password = ref("");
const loading = ref(false);
const loginError = ref("");
const session = useUserSession();

async function handleSubmit() {
  loginError.value = "";
  loading.value = true;

  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: {
        email: email.value,
        password: password.value,
      },
    });

    await session.fetch();
    await navigateTo("/");
  } catch (error) {
    loginError.value =
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
        <h1 class="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p class="mt-2 text-sm text-slate-400">Market Validator Dashboard</p>

        <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
          <label class="block text-sm">
            <span class="mb-1 block text-slate-300">Email</span>
            <input
              v-model="email"
              type="email"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              required
            />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-slate-300">Password</span>
            <input
              v-model="password"
              type="password"
              class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-indigo-500/40 transition focus:ring"
              required
            />
          </label>

          <p v-if="loginError" class="text-sm text-rose-400">
            {{ loginError }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-70"
          >
            {{ loading ? "Signing in..." : "Sign in" }}
          </button>

          <p class="text-center text-sm text-slate-400">
            No account?
            <NuxtLink
              to="/register"
              class="text-indigo-300 hover:text-indigo-200"
            >
              Create one
            </NuxtLink>
          </p>
        </form>
      </div>
    </div>
  </main>
</template>
