export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = "mini-mystics.settings";
export type GameSettings = {
  gameplay: { animationMode: "minimal" | "standard" | "cinematic"; battleSpeed: "fast" | "normal" | "deliberate"; autoAdvance: boolean; confirmEndTurn: boolean; showDamageDetails: boolean };
  audio: { masterVolume: number; musicVolume: number; sfxVolume: number; musicEnabled: boolean; sfxEnabled: boolean; uiSoundsEnabled: boolean; battleMusicEnabled: boolean };
  visual: { screenShake: boolean; reducedMotion: boolean; particleEffects: "off" | "reduced" | "full"; effectsQuality: "low" | "medium" | "high"; floatingCombatText: boolean; cardHoverEffects: boolean };
  interface: { tooltips: boolean; tutorialTips: boolean; compactBattleUI: boolean; showBattleStats: boolean };
  accessibility: { highContrast: boolean; largerText: boolean; disableFlashEffects: boolean; colorblindMode: "off" | "protanopia" | "deuteranopia" | "tritanopia" };
};
export function defaultSettings(reducedMotion = false, mobile = false): GameSettings {
  return {
    gameplay: { animationMode: "standard", battleSpeed: "normal", autoAdvance: true, confirmEndTurn: false, showDamageDetails: false },
    audio: { masterVolume: 80, musicVolume: 45, sfxVolume: 75, musicEnabled: true, sfxEnabled: true, uiSoundsEnabled: true, battleMusicEnabled: true },
    visual: { screenShake: true, reducedMotion, particleEffects: "full", effectsQuality: mobile ? "medium" : "high", floatingCombatText: true, cardHoverEffects: !mobile },
    interface: { tooltips: true, tutorialTips: true, compactBattleUI: false, showBattleStats: true },
    accessibility: { highContrast: false, largerText: false, disableFlashEffects: false, colorblindMode: "off" },
  };
}
const choices: Record<string, string[]> = {
  animationMode: ["minimal", "standard", "cinematic"], battleSpeed: ["fast", "normal", "deliberate"],
  particleEffects: ["off", "reduced", "full"], effectsQuality: ["low", "medium", "high"], colorblindMode: ["off", "protanopia", "deuteranopia", "tritanopia"],
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function validateSettings(value: unknown, defaults = defaultSettings()): GameSettings {
  const result = structuredClone(defaults);
  for (const group of Object.keys(result) as (keyof GameSettings)[]) {
    const incoming = record(record(value)[group]);
    const target = result[group] as Record<string, unknown>;
    for (const key of Object.keys(target)) {
      const next = incoming[key];
      if (typeof target[key] === "boolean" && typeof next === "boolean") target[key] = next;
      else if (typeof target[key] === "number" && typeof next === "number" && Number.isFinite(next)) target[key] = Math.round(Math.max(0, Math.min(100, next)));
      else if (typeof next === "string" && choices[key]?.includes(next)) target[key] = next;
    }
  }
  return result;
}
export function readSettings(raw: string | null, defaults = defaultSettings()) {
  try {
    const saved = record(JSON.parse(raw ?? "null"));
    if (saved.version !== SETTINGS_VERSION) return { settings: defaults, motionExplicit: false };
    return { settings: validateSettings(saved.settings, defaults), motionExplicit: saved.motionExplicit === true };
  } catch { return { settings: defaults, motionExplicit: false }; }
}
export function serializeSettings(settings: GameSettings, motionExplicit: boolean) {
  return JSON.stringify({ version: SETTINGS_VERSION, settings: validateSettings(settings), motionExplicit });
}
