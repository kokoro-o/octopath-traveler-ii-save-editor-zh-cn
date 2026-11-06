import { error } from "@sveltejs/kit";
import { gameTemplate, gameUtils } from "$lib/stores";

// Keep the existing editor URL while allowing only this game's save editor.
export function entries() {
  return [{ gameId: "octopath-traveler-ii", tool: "save-editor" }];
}

export async function load({ params }): Promise<void> {
  if (params.gameId !== "octopath-traveler-ii" || params.tool !== "save-editor") {
    error(404, { message: "Not found" });
  }
  const template = (await import("$lib/templates/octopath-traveler-ii/saveEditor/template")).default;
  const utils = await import("$lib/templates/octopath-traveler-ii/saveEditor/utils");
  gameUtils.set(utils);
  gameTemplate.set(template);
}
