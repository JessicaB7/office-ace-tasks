import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";



// Public (publishable) backend values. Safe to ship in the browser bundle —
// row level security protects the data. Used as a fallback so a build without
// a .env never produces a blank published app.
const FALLBACK_SUPABASE_URL = "https://unwzlmdwvpxhigmsqvam.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVud3psbWR3dnB4aGlnbXNxdmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NDIwOTYsImV4cCI6MjEwNjExODA5Nn0.lpWoSY8Zy2kQgdBcKzbH2Y2CWWF9WMUFBuxV9wTRM-I";
const FALLBACK_SUPABASE_PROJECT_ID = "unwzlmdwvpxhigmsqvam";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const resolved = {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID:
      env.VITE_SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID,
  };

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: Object.fromEntries(
      Object.entries(resolved).map(([k, v]) => [
        `import.meta.env.${k}`,
        JSON.stringify(v),
      ])
    ),
plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
