import { expect, test } from "@playwright/test";
import { AVAILABLE_AUDIO } from "../../lib/audio/registry";

test("supplied audio decodes and menu/SFX playback advances after interaction", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.Audio;
    const tracked: HTMLAudioElement[] = [];
    Object.assign(window, { presentationAudio: tracked });
    window.Audio = new Proxy(original, { construct(target, args) {
      const audio = Reflect.construct(target, args) as HTMLAudioElement;
      tracked.push(audio); return audio;
    } });
  });
  await page.goto("/settings");
  await expect(page.getByLabel("Master Volume", { exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Preview impact" }).click();
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { presentationAudio: HTMLAudioElement[] }).presentationAudio;
    return audio.filter((item) => item.currentTime > .1 && item.volume > 0 && !item.error).map((item) => new URL(item.src).pathname);
  })).toEqual(expect.arrayContaining(["/audio/music/menu-theme.mp3", "/audio/sfx/attack-hit.mp3"]));
  const files = await page.evaluate(async (paths) => {
    const context = new AudioContext();
    const results = [];
    for (const path of paths) {
      const response = await fetch(path);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let index = 0; index < samples.length; index++) peak = Math.max(peak, Math.abs(samples[index]));
      }
      results.push({ path, status: response.status, duration: buffer.duration, peak });
    }
    await context.close(); return results;
  }, [...AVAILABLE_AUDIO]);
  expect(files.every((file) => file.status === 200 && file.duration > 0 && file.peak > .001)).toBe(true);
  console.log("Audio playback and decoding verified:", JSON.stringify(files));
});
