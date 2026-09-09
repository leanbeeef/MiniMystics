import { describe, expect, it } from "vitest";
import { defaultSettings, readSettings, serializeSettings, validateSettings } from "./settings";
import { animationConfig, effectDuration } from "./animations/config";
describe("device settings", () => {
  it("round trips every preference and explicit motion choice across a refresh", () => {
    const settings = defaultSettings();
    settings.gameplay.animationMode = "cinematic"; settings.audio.masterVolume = 23; settings.visual.reducedMotion = true;
    expect(readSettings(serializeSettings(settings, true))).toEqual({ settings, motionExplicit: true });
  });
  it("validates partial, malformed and future saves without losing sensible defaults", () => {
    expect(readSettings("not json").settings).toEqual(defaultSettings());
    expect(readSettings('{"version":99,"settings":{}}').settings).toEqual(defaultSettings());
    const result = validateSettings({ audio: { masterVolume: 500, musicVolume: -12, sfxVolume: NaN }, visual: { reducedMotion: "false" }, gameplay: { animationMode: "bogus" } });
    expect(result.audio).toMatchObject({ masterVolume: 100, musicVolume: 0, sfxVolume: 75 });
    expect(result.visual.reducedMotion).toBe(false);
    expect(result.gameplay.animationMode).toBe("standard");
  });
  it("uses reduced motion and mobile defaults when no explicit choice exists", () => {
    const result = readSettings(null, defaultSettings(true, true));
    expect(result.settings.visual).toMatchObject({ reducedMotion: true, effectsQuality: "medium", cardHoverEffects: false });
    expect(result.motionExplicit).toBe(false);
  });
});
describe("global presentation configuration", () => {
  it("makes Minimal quicker and Cinematic Apex larger without changing transition speed", () => {
    const settings = defaultSettings();
    const standard = animationConfig(settings);
    settings.gameplay.animationMode = "minimal";
    const minimal = animationConfig(settings);
    settings.gameplay.animationMode = "cinematic";
    const cinematic = animationConfig(settings);
    expect(minimal.special).toBeLessThan(standard.special / 2);
    expect(minimal.particles).toBe(0);
    expect(cinematic.apex).toBeGreaterThanOrEqual(1500);
    expect(cinematic.apex).toBeLessThanOrEqual(3000);
    expect(cinematic.distance).toBeGreaterThan(standard.distance);
    expect(minimal.gap).toBe(cinematic.gap);
    expect(effectDuration(2300, minimal)).toBeLessThanOrEqual(400);
  });
  it("lets reduced motion override cinematics, shake, flashes and particles", () => {
    const settings = defaultSettings(true);
    settings.gameplay.animationMode = "cinematic";
    expect(animationConfig(settings)).toMatchObject({ shake: false, flash: false, distance: 0, cinematic: false, ambient: false, particles: 0 });
  });
  it("independently controls shake, flash, quality, particles, and battle speed", () => {
    const settings = defaultSettings();
    settings.visual.screenShake = false; settings.accessibility.disableFlashEffects = true;
    expect(animationConfig(settings)).toMatchObject({ shake: false, flash: false });
    const full = animationConfig(settings);
    settings.visual.effectsQuality = "low";
    expect(animationConfig(settings).particles).toBeLessThan(full.particles);
    settings.visual.particleEffects = "off";
    expect(animationConfig(settings).particles).toBe(0);
    settings.gameplay.battleSpeed = "fast";
    expect(animationConfig(settings).gap).toBeLessThan(full.gap);
    expect(animationConfig(settings).basic).toBe(full.basic);
  });
});
