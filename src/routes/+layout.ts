import { get } from "svelte/store";

import { debugOptions } from "$lib/stores";
import { setLocalStorage } from "$lib/utils/format";

import "$lib/utils/prototype";

// Generate HTML entry points for static hosts; all save processing runs locally.
export const prerender = true;
export const ssr = false;
export const trailingSlash = "always";

const isBrowser = typeof window !== "undefined";

if (isBrowser) {
  window.debugGTC = {
    toggleTool: (tool: string) => {
      const $debugOptions = get(debugOptions);

      $debugOptions[tool] = !$debugOptions[tool];

      debugOptions.set($debugOptions);

      setLocalStorage("debugOptions", `${JSON.stringify($debugOptions)}`);
    },
  };
}
