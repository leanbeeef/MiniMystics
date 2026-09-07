export const RARITIES = ["Wild", "Hunter", "Predator", "Prime", "Alpha", "Apex"] as const;
export type Rarity = (typeof RARITIES)[number];

// ---------------------------------------------------------------------------
// Reusable effect grammar. Every Special Move / Handler passive is expressed as
// zero or more of these — no per-Mystic-ID or per-Handler-ID branching anywhere.
// ---------------------------------------------------------------------------

export type EffectDuration =
  | { unit: "turns"; count: number } // "for N turn(s)" — ticks down starting at the owner's next turn
  | { unit: "untilOwnerNextTurn" } // "until your next turn" / "until the start of your next turn" — expires once, at the owner's next turn start
  | { unit: "thisAttackOnly" }; // "for this attack" — folded directly into the current damage calc, never persists

export type EffectSubject = "self" | "target" | "allyAuto" | "allTeam";

export type EffectSpec =
  | { kind: "statModifier"; stat: "atk" | "def" | "power"; subject: EffectSubject; percent: number; duration: EffectDuration }
  | { kind: "heal" | "recoil"; subject: "self"; percent: number } // one-time, % of max Power Score
  | { kind: "cooldownDelta"; subject: "self" | "target"; scope: "longestActive" | "otherMove" | "bothMoves"; amount: number }
  | { kind: "markDefenseOnNextHit"; subject: "target"; percent: number }
  | { kind: "retaliateAtkDebuff"; subject: "self"; percent: number }
  | { kind: "silence" | "stun" | "untouchable"; subject: "self" | "target"; duration: EffectDuration }
  | { kind: "regen" | "dot"; subject: "self" | "target"; percent: number; duration: EffectDuration }
  | { kind: "chanceRecoilSplash"; chancePercent: number; percentOfDamageDealt: number }
  // Handler-passive-only: applied whenever this Mystic's own move enters cooldown, not a per-turn tick.
  | { kind: "cooldownReductionPerUse"; amount: number; floor: number };

export type ParsedMove = {
  name: string;
  requiredRoll: number; // D8 target (minimum roll to succeed)
  cooldown: number;
  targetType: "self" | "ally" | "enemy";
  damageModifierPercent?: number; // "This attack gains +X% ATK" / "deals +X% ATK" — applies only to this use
  effects: EffectSpec[];
  rawText: string;
  needsReview: boolean;
  reviewReason?: string;
};

export type PassiveEffect = {
  name: string;
  targetLabel: string; // the Allegiance or Order name this passive applies to
  effects: EffectSpec[];
  rawText: string;
};

export type MysticDefinition = {
  id: string;
  name: string;
  order: string;
  allegiance: string;
  rarity: Rarity;
  power: number;
  defense: number;
  baseAttack: number;
  moves: ParsedMove[];
  image: string | null;
};

export type HandlerDefinition = {
  id: string;
  name: string;
  allegiance: string;
  order: string;
  rarity: Rarity | "Unassigned";
  originalRarity: string;
  image: string | null;
  notes: string;
  allegiancePassive: PassiveEffect;
  orderPassive: PassiveEffect;
};

export type CardCatalog = { mystics: MysticDefinition[]; handlers: HandlerDefinition[]; importWarnings: string[] };

// ---------------------------------------------------------------------------
// Battle-time state
// ---------------------------------------------------------------------------

export type StatusEffect = {
  id: string;
  kind: EffectSpec["kind"];
  stat?: "atk" | "def" | "power";
  percent: number; // signed: positive = buff/beneficial, negative = debuff/harmful
  duration: EffectDuration;
  remainingTurns: number; // meaningful only for duration.unit === "turns"
  sourceInstanceId: string;
  sourceSide: "player" | "ai";
  label: string; // battle-log / UI facing description, taken from the move's own wording
};

export type HandlerBonuses = {
  atkPercent: number;
  defPercent: number;
  powerPercent: number;
  cooldownReductionPerUse: number;
  cooldownReductionFloor: number;
  sources: string[]; // Handler names contributing, for UI display
};

export type Combatant = {
  instanceId: string;
  definitionId: string;
  name: string;
  image: string | null;
  rarity: Rarity;
  order: string;
  allegiance: string;
  level: number;
  printedPower: number;
  printedDefense: number;
  printedBaseAttack: number;
  maxPower: number; // leveled
  currentPower: number;
  defense: number; // leveled
  baseAttack: number; // leveled
  moves: ParsedMove[];
  cooldowns: Record<string, number>;
  activeEffects: StatusEffect[];
  handlerBonuses: HandlerBonuses;
  defeated: boolean;
};

export type BattleSide = {
  id: "player" | "ai";
  name: string;
  mystics: Combatant[];
  handlers: string[]; // equipped Handler definitionIds — passive only, no per-match state
  synergies: Record<string, number>; // Order -> percent, fixed at battle start
};

export type BattleEvent = {
  id: string;
  turn: number;
  type: "system" | "roll" | "attack" | "special" | "advantage" | "passive" | "synergy" | "damage" | "heal" | "buff" | "debuff" | "cooldown" | "ko" | "victory";
  message: string;
  data?: Record<string, string | number | boolean>;
};

export type BattleState = {
  id: string;
  campaignId?: string;
  size: 3 | 5 | 8;
  player: BattleSide;
  ai: BattleSide;
  currentTurn: "player" | "ai";
  turnNumber: number;
  winner: "player" | "ai" | null;
  events: BattleEvent[];
  lastRoll: number | null;
};
