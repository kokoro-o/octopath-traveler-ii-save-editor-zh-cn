import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import test, { Browser, type Page } from "@playwright/test";

import { expectChecksum } from "./modules/checksum";
import { expectInput, writeInput } from "./modules/input";
import { selectRegion } from "./modules/region";
import { expectTabs, selectTab } from "./modules/tabs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const path = `${__dirname}/saves`;

export function extractGameName(filePath: string): string {
  const fileName = filePath.split("/").pop();

  return fileName?.replace(".test.ts", "") || "";
}

let page: Page;

export async function initPage(browser: Browser, url: string): Promise<void> {
  if (!page) {
    page = await browser.newPage();
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.addInitScript(() => {
    localStorage.setItem("debug", "true");
    localStorage.setItem("debugOptions", '{"showHiddenItems":true,"showChecksums":true}');
  });

  await page.goto(url, {
    waitUntil: "networkidle",
  });
}

export async function ejectFile(): Promise<void> {
  const contentEl = await page.$(".gtc-tool > .gtc-content");

  if (contentEl) {
    await page.locator(".gtc-tool-eject").click();
  }
}

export async function saveShouldBeRejected(
  saveFilePath: string,
): Promise<void> {
  const isFileExists = fs.existsSync(`${path}/${saveFilePath}`);

  test.expect(isFileExists).toBeTruthy();

  await page
    .locator('input[type="file"]')
    .setInputFiles(`${path}/${saveFilePath}`);

  const dropzoneErrorEl = await page.$(".gtc-tool-error");

  if (!dropzoneErrorEl) {
    console.log(`Tested file: "${`${path}/${saveFilePath}`}"`);
  }

  test.expect(dropzoneErrorEl).toBeTruthy();
}

export function defaultTests(_game: string, _platforms: string[]): void {
  for (const [name, buffer] of [
    ["empty file", Buffer.alloc(0)],
    ["invalid save", Buffer.from("Not a GVAS save")],
  ] as const) {
    test(`should not load an ${name}`, async () => {
      await page.locator('input[type="file"]').setInputFiles({
        name: "SaveData0.sav", mimeType: "application/octet-stream", buffer,
      });
      await test.expect(page.locator(".gtc-tool-error")).toBeVisible();
    });
  }
}

export type Test = [string, string, string[]];

export async function snippet(
  saveFilePath: string,
  actions: string[] | null,
): Promise<void> {
  const isFileExists = fs.existsSync(`${path}/${saveFilePath}`);

  test.expect(isFileExists).toBeTruthy();

  await page
    .locator('input[type="file"]')
    .setInputFiles(`${path}/${saveFilePath}`);

  if (actions !== null) {
    await actions.reduce(async (previousAction, action) => {
      await previousAction;

      test.expect(action).toContain("|");

      const [type, value, index] = action.split(/[|$]/);

      const elIndex = index ? parseInt(index) - 1 : 0;

      if (!["c", "i", "n", "r", "s", "t", "w"].includes(type)) {
        test.expect(false).toBeTruthy();

        return;
      }

      if (type === "c") {
        await expectChecksum(page, value, elIndex);
      }

      if (type === "i") {
        await expectInput(page, value, elIndex);
      }

      if (type === "n") {
        await expectInput(page, value, elIndex, false);
      }

      if (type === "r") {
        await selectRegion(page, value);
      }

      if (type === "s") {
        await selectTab(page, value, elIndex);
      }

      if (type === "t") {
        await expectTabs(page, value, elIndex);
      }

      if (type === "w") {
        await writeInput(page, value, elIndex);
      }
    }, Promise.resolve());
  }
}
