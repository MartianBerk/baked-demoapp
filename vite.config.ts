import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const authUpstream = env.AUTH_UPSTREAM || "http://127.0.0.1:8000";
  const userUpstream = env.USER_UPSTREAM || "http://127.0.0.1:8001";

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        "/auth": {
          target: authUpstream,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/auth/, ""),
        },
        "/user": {
          target: userUpstream,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/user/, ""),
        },
      },
    },
    preview: {
      port: 3000,
    },
  };
});
