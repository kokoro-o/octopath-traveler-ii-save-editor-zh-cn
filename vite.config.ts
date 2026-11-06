import { sveltekit } from "@sveltejs/kit/vite";
import { VERSION as svelteVersion } from "svelte/compiler";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "svelte4-kit-state-compatibility",
      enforce: "pre",
      transform(code, id) {
        // Kit detects legacy Svelte by inspecting onMount.toString(). The
        // production SSR bundle reformats its empty function, breaking that
        // heuristic and executing uncompiled Svelte 5 runes under Svelte 4.
        if (
          svelteVersion.startsWith("4.") &&
          id.replaceAll("\\", "/").endsWith("/@sveltejs/kit/src/runtime/client/state.svelte.js")
        ) {
          return {
            code: code.replace(/const is_legacy =[\s\S]*?;/, "const is_legacy = true;"),
            map: null,
          };
        }
      },
    },
    sveltekit(),
  ],
});
