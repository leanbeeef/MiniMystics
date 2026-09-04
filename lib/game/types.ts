export const RARITIES = ["Wild", "Hunter", "Predator", "Prime", "Alpha", "Apex"] as const;
export type Rarity = (typeof RARITIES)[number];

export type ParsedMove = {
  name: string;
  requiredRoll: number;
  minimumRoll?: number;
  exactRoll?: number;
  attackModifier?: number;
  defenseModifier?: number;
  enemyAttackModifier?: number;
  enemyDefenseModifier?: number;
  healing?: number;
  multiHitCount?: number;
  attackMultiplier?: number;
  ignoreDefense?: boolean;
  evade?: boolean;
  counter?: number | "base";
  skipTurn?: boolean;
  selfDamage?: number;
  cooldown: number;
  duration?: string;
  targetType: "self" | "ally" | "enemy";
  rawText: string;
  needsReview: boolean;
  reviewReason?: string;
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
  activationRoll: number;
  exactRoll: boolean;
  activationDice: number;
  effect: string;
  effectType: string;
  effectValue: string;
  duration: string;
  maxUses: number;
  target: "ally" | "enemy";
  image: string | null;
  notes: string;
};

export type CardCatalog = { mystics: MysticDefinition[]; handlers: HandlerDefinition[]; importWarnings: string[] };

export type Combatant = {
  instanceId: string;
  definitionId: string;
  name: string;
  image: string | null;
  rarity: Rarity;
  order: string;
  maxPower: number;
  currentPower: number;
  defense: number;
  baseAttack: number;
  moves: ParsedMove[];
  cooldowns: Record<string, number>;
  effects: StatusEffect[];
  defeated: boolean;
};

export type StatusEffect = {
  id: string;
  kind: "attack" | "defense" | "marked" | "evade" | "specialLock" | "counter" | "reroll";
  value: number;
  expiresAt: "ownerTurnStart" | "sourceTurnStart" | "onAttack" | "onDamage";
  sourceSide: "player" | "ai";
};

export type BattleSide = {
  id: "player" | "ai";
  name: string;
  mystics: Combatant[];
  handlers: { definitionId: string; name: string; uses: number; maxUses: number; activationRoll: number; exactRoll: boolean; effectType: string }[];
};

export type BattleEvent = {
  id: string;
  turn: number;
  type: "system" | "roll" | "attack" | "special" | "handler" | "damage" | "heal" | "ko" | "victory";
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
