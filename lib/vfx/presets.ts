import type { Rarity } from "@/lib/game/types";

export type VfxIntensity = "low" | "medium" | "high" | "apex";
export type BattleEffectName = "impact" | "fire-impact" | "celestial-impact" | "nature-impact" | "forge-impact" | "dream-impact" | "time-impact" | "portal-impact" | "electric-impact" | "void-impact" | "shield" | "heal" | "buff" | "debuff" | "ko";
export type PackEffectName = "pack-open" | "shimmer" | "wild-reveal" | "hunter-reveal" | "predator-reveal" | "prime-reveal" | "alpha-reveal" | "apex-reveal";
export type VfxEffectName = BattleEffectName | PackEffectName;

export type VfxPreset = {
  vfxTheme: string;
  accentColor: string;
  secondaryColor: string;
  particlePreset: "dust" | "spark" | "ember" | "mote" | "fragment" | "star";
  revealIntensity: VfxIntensity;
  backgroundEffect: "none" | "glow" | "pulse" | "ring" | "starburst";
  duration: number;
  speed: [number, number];
};

const preset = (partial: Partial<VfxPreset>): VfxPreset => ({
  vfxTheme: "neutral",
  accentColor: "#f2c14e",
  secondaryColor: "#fff1bd",
  particlePreset: "spark",
  revealIntensity: "medium",
  backgroundEffect: "glow",
  duration: 560,
  speed: [55, 125],
  ...partial,
});

export const BATTLE_VFX: Record<BattleEffectName, VfxPreset> = {
  impact: preset({ vfxTheme: "physical", accentColor: "#f0b54f", secondaryColor: "#fff0c3", duration: 420 }),
  "fire-impact": preset({ vfxTheme: "sunspire", accentColor: "#ff8b2c", secondaryColor: "#ffd05d", particlePreset: "ember", duration: 680, speed: [70, 155] }),
  "celestial-impact": preset({ vfxTheme: "star", accentColor: "#f2c14e", secondaryColor: "#ffffff", particlePreset: "star", duration: 720, speed: [65, 145] }),
  "nature-impact": preset({ vfxTheme: "verdant", accentColor: "#69b95f", secondaryColor: "#d6e58a", particlePreset: "mote", duration: 650, speed: [45, 110] }),
  "forge-impact": preset({ vfxTheme: "worldforge", accentColor: "#ef873f", secondaryColor: "#d8c3a0", particlePreset: "fragment", duration: 620, speed: [75, 150] }),
  "dream-impact": preset({ vfxTheme: "moonveil", accentColor: "#a56ad7", secondaryColor: "#e0bdf2", particlePreset: "mote", duration: 720, speed: [35, 95] }),
  "time-impact": preset({ vfxTheme: "agespire", accentColor: "#38b6c8", secondaryColor: "#b9f2e8", particlePreset: "dust", duration: 720, speed: [45, 105], backgroundEffect: "ring" }),
  "portal-impact": preset({ vfxTheme: "stargate", accentColor: "#3a99e8", secondaryColor: "#c5efff", particlePreset: "spark", duration: 700, speed: [80, 165], backgroundEffect: "ring" }),
  "electric-impact": preset({ vfxTheme: "first-spark", accentColor: "#ffb42d", secondaryColor: "#fff39c", particlePreset: "spark", duration: 520, speed: [95, 190] }),
  "void-impact": preset({ vfxTheme: "void", accentColor: "#7042a8", secondaryColor: "#c384e4", particlePreset: "fragment", duration: 760, speed: [45, 120], backgroundEffect: "pulse" }),
  shield: preset({ vfxTheme: "shield", accentColor: "#79c9ef", secondaryColor: "#e8fbff", particlePreset: "mote", revealIntensity: "low", backgroundEffect: "ring", duration: 700, speed: [20, 55] }),
  heal: preset({ vfxTheme: "heal", accentColor: "#73c77d", secondaryColor: "#e2ef9a", particlePreset: "mote", revealIntensity: "low", backgroundEffect: "glow", duration: 760, speed: [28, 70] }),
  buff: preset({ vfxTheme: "buff", accentColor: "#e0ba58", secondaryColor: "#fff0b1", particlePreset: "star", revealIntensity: "low", backgroundEffect: "ring", duration: 620, speed: [30, 80] }),
  debuff: preset({ vfxTheme: "debuff", accentColor: "#a663c8", secondaryColor: "#dc9be8", particlePreset: "fragment", revealIntensity: "low", backgroundEffect: "pulse", duration: 680, speed: [30, 90] }),
  ko: preset({ vfxTheme: "ko", accentColor: "#675476", secondaryColor: "#b08ab9", particlePreset: "fragment", revealIntensity: "high", backgroundEffect: "pulse", duration: 1050, speed: [45, 135] }),
};

export const PACK_VFX: Record<PackEffectName, VfxPreset> = {
  "pack-open": preset({ vfxTheme: "celestial", accentColor: "#d7a93b", secondaryColor: "#e8ddba", particlePreset: "dust", revealIntensity: "low", duration: 900, speed: [18, 55] }),
  shimmer: preset({ vfxTheme: "pre-reveal", accentColor: "#d5c89e", secondaryColor: "#ffffff", particlePreset: "dust", revealIntensity: "low", duration: 360, speed: [12, 38] }),
  "wild-reveal": preset({ vfxTheme: "wild", accentColor: "#c5c7c9", secondaryColor: "#f4f1e8", particlePreset: "dust", revealIntensity: "low", backgroundEffect: "none", duration: 420, speed: [25, 70] }),
  "hunter-reveal": preset({ vfxTheme: "hunter", accentColor: "#57af74", secondaryColor: "#b8e5c5", particlePreset: "mote", revealIntensity: "low", duration: 620, speed: [35, 90] }),
  "predator-reveal": preset({ vfxTheme: "predator", accentColor: "#4f9fdb", secondaryColor: "#caedff", particlePreset: "spark", revealIntensity: "medium", duration: 760, speed: [55, 125] }),
  "prime-reveal": preset({ vfxTheme: "prime", accentColor: "#a96ad3", secondaryColor: "#e7c5f6", particlePreset: "mote", revealIntensity: "medium", backgroundEffect: "pulse", duration: 940, speed: [35, 100] }),
  "alpha-reveal": preset({ vfxTheme: "alpha", accentColor: "#f2c14e", secondaryColor: "#ffffff", particlePreset: "star", revealIntensity: "high", backgroundEffect: "starburst", duration: 1400, speed: [70, 175] }),
  "apex-reveal": preset({ vfxTheme: "apex", accentColor: "#fff0a6", secondaryColor: "#ffffff", particlePreset: "star", revealIntensity: "apex", backgroundEffect: "starburst", duration: 2300, speed: [80, 210] }),
};

export const ORDER_BATTLE_EFFECT: Record<string, BattleEffectName> = {
  Sunspire: "fire-impact",
  "Sovereign Order": "celestial-impact",
  "Order of the Star": "celestial-impact",
  Starwatch: "celestial-impact",
  "Verdant Dawn": "nature-impact",
  Worldforge: "forge-impact",
  Moonveil: "dream-impact",
  Agespire: "time-impact",
  Stargate: "portal-impact",
  "First Spark": "electric-impact",
  Void: "void-impact",
};

export const RARITY_PACK_EFFECT: Record<Rarity | "Unassigned", PackEffectName> = {
  Wild: "wild-reveal",
  Hunter: "hunter-reveal",
  Predator: "predator-reveal",
  Prime: "prime-reveal",
  Alpha: "alpha-reveal",
  Apex: "apex-reveal",
  Unassigned: "prime-reveal",
};

