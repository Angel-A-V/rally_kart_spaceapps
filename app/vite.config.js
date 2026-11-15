// Vite settings.
// The project lives on the Windows drive (/mnt/c) but Vite runs in WSL, and Windows does not
// tell WSL when a file changes. Polling makes Vite check the files itself instead.
//
// Proxy: during `npm run dev`, requests to /api/... are forwarded to the Python backend
// (app/python/server/app.py, port 8000), so the page can call it as if it were on the same site.
export default {
  server: {
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
};
