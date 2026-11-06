import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const base = process.env.BASE_PATH || "";
if (base && (!/^\/[A-Za-z0-9._-]+$/.test(base) || base === "/." || base === "/..")) {
  throw new Error("BASE_PATH must be empty or a repository path such as /game-tools-collection (no trailing slash).");
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ pages: "build", assets: "build", fallback: "404.html" }),
    paths: { base, relative: false },
  },
  onwarn: (warning, handler) => {
    if (warning.code.startsWith("a11y-")) {
      return;
    }
    handler(warning);
  },
  preprocess: vitePreprocess(),
};

export default config;
