import type { GameSettings } from "../settings";
export const ANIMATION_PRESETS = {
  minimal: { basic: 240, special: 360, apex: 380, ui: 150, distance: 5, particles: 0, camera: false },
  standard: { basic: 520, special: 850, apex: 1100, ui: 220, distance: 16, particles: 1, camera: true },
  cinematic: { basic: 700, special: 1300, apex: 2400, ui: 350, distance: 28, particles: 1.4, camera: true },
} as const;
export function animationConfig(settings: GameSettings) {
  const preset = ANIMATION_PRESETS[settings.visual.reducedMotion ? "minimal" : settings.gameplay.animationMode];
  const reduced = settings.visual.reducedMotion;
  const quality = { low: .3, medium: .6, high: 1 }[settings.visual.effectsQuality];
  return {
    ...preset, reduced, distance: reduced ? 0 : preset.distance,
    particles: reduced ? 0 : preset.particles * quality * ({ off: 0, reduced: .35, full: 1 }[settings.visual.particleEffects]),
    maxEffects: settings.visual.effectsQuality === "low" ? 2 : settings.visual.effectsQuality === "medium" ? 4 : 8,
    shake: !reduced && preset.camera && settings.visual.screenShake,
    flash: !reduced && !settings.accessibility.disableFlashEffects,
    cinematic: !reduced && settings.gameplay.animationMode === "cinematic",
    ambient: !reduced && preset.particles > 0 && settings.visual.effectsQuality !== "low" && settings.visual.particleEffects !== "off",
    gap: { fast: 80, normal: 220, deliberate: 650 }[settings.gameplay.battleSpeed],
    floatingText: settings.visual.floatingCombatText,
  };
}
export type AnimationConfig = ReturnType<typeof animationConfig>;
export const DICE_RESULT_HOLD_MS = 1000;
export function diceSettleDuration(config: AnimationConfig) {
  return config.reduced ? 0 : Math.min(config.ui * .65, config.special * .15);
}
export function effectDuration(base: number, config: AnimationConfig) {
  return Math.round(Math.max(150, Math.min(config.cinematic ? 3000 : config.reduced || config.basic < 300 ? 400 : 1200, base * config.basic / 520)));
}
