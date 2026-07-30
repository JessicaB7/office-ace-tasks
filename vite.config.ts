import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Ensures the published build always contains the backend env vars.
// If any required var is missing during `vite build`, the build fails
// fast with a clear message instead of shipping a blank app.
function requireBackendEnv(mode: string): Plugin {
  const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  return {
    name: "require-backend-env",
    apply: "build",
    configResolved() {
      const env = loadEnv(mode, process.cwd(), "");
      const missing = REQUIRED.filter(
        (k) => !env[k] && !process.env[k]
      );
      if (missing.length > 0) {
        throw new Error(
          `[build aborted] Missing required backend env var(s): ${missing.join(
            ", "
          )}. The app cannot be published without them — reconnect Lovable Cloud / restore the .env before republishing.`
        );
      }
    },
  };
}

// Public (publishable) backend values. Safe to ship in the browser bundle —
// row level security protects the data. Used as a fallback so a build without
// a .env never produces a blank published app.
const FALLBACK_SUPABASE_URL = "https://bdilsjrlwevkgjivqpgg.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkaWxzanJsd2V2a2dqaXZxcGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzM4MjksImV4cCI6MjA5MDgwOTgyOX0.3yy_fp7-OfqKPaM5CFnNGPRbH7B1jxgrPBTdCP3WmFw";
const FALLBACK_SUPABASE_PROJECT_ID = "bdilsjrlwevkgjivqpgg";

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
    plugins: [react(), mode === "development" && componentTagger()].filter(
      Boolean
    ),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
