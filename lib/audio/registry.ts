export const MUSIC = {
  menu: "/audio/music/menu-theme.mp3", battle: "/audio/music/battle-theme-01.mp3",
  victory: "/audio/music/victory.mp3", defeat: "/audio/music/defeat.mp3",
} as const;
export const SFX_NAMES = ["ui-click", "ui-hover", "card-select", "card-draw", "attack-basic", "attack-hit", "attack-miss", "special-charge", "special-success", "special-fail", "buff", "debuff", "heal", "shield", "cooldown", "order-advantage", "handler-use", "handler-success", "handler-fail", "mystic-defeat", "victory", "defeat", "pack-open", "pack-reveal", "alpha-reveal", "apex-reveal"] as const;
export type SfxName = typeof SFX_NAMES[number];
export type MusicName = keyof typeof MUSIC;
export const SFX = Object.fromEntries(SFX_NAMES.map((name) => [name, `/audio/sfx/${name}.mp3`])) as Record<SfxName, string>;
// Add registry paths here only after placing licensed audio files in public/audio.
// Empty slots are silent and never make failing network requests.
export const AVAILABLE_AUDIO: ReadonlySet<string> = new Set<string>([
  MUSIC.menu, MUSIC.battle,
  SFX["ui-click"], SFX["ui-hover"], SFX["card-select"], SFX["card-draw"],
  SFX["attack-basic"], SFX["attack-hit"], SFX["attack-miss"],
  SFX["special-charge"], SFX["special-success"], SFX["special-fail"],
  SFX.buff, SFX.debuff, SFX.heal, SFX.shield, SFX.cooldown,
  SFX["order-advantage"], SFX["mystic-defeat"], SFX.victory, SFX.defeat,
  SFX["pack-open"], SFX["pack-reveal"], SFX["alpha-reveal"], SFX["apex-reveal"],
]);
export const AUDIO_HOOKS: Record<string, SfxName> = {
  card_select: "card-select", target_select: "card-select", dice_roll: "special-charge", special: "special-success", damage: "attack-hit", ko: "mystic-defeat",
  heal: "heal", victory: "victory", defeat: "defeat", pack_open: "pack-open", card_flip: "card-draw",
  wild_reveal: "pack-reveal", hunter_reveal: "pack-reveal", predator_reveal: "pack-reveal", prime_reveal: "pack-reveal", alpha_reveal: "alpha-reveal", apex_reveal: "apex-reveal",
};
