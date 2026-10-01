import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base =
    env.VITE_BASE_PATH ||
    (process.env.GITHUB_ACTIONS ? "/education-training-platform/" : "/");
  const apiUrl = env.VITE_API_URL;
  let validApiUrl = false;
  try {
    const parsed = new URL(apiUrl);
    validApiUrl =
      parsed.protocol === "https:" &&
      parsed.pathname.replace(/\/$/, "").endsWith("/api") &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash;
  } catch {
    /* An unset URL is expected during local development. */
  }
  if (base === "/education-training-platform/" && !validApiUrl) {
    throw new Error(
      "The GitHub Pages build requires VITE_API_URL set to the public HTTPS backend URL, ending in /api.",
    );
  }
  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
