# Stack

This is Nuxt4 project.
Use the auto-imports feature. Read: https://nuxt.com/docs/4.x/guide/concepts/auto-imports

# Error handling

Read: https://nuxt.com/docs/4.x/getting-started/error-handling

## Server side throw

To pass errors from the server side use template:

```js
throw createError({
  status: 400, // Example - Bad Request
  statusText: "Example status message",
  message: "Example message to User.",
});
```

## Front end catch

To use the error on front side use template:

```js
catch (error) {
  deleteError.value =
  error.data.message || "Genering error message if .message is not passed.";
  console.error(error);
}
```
