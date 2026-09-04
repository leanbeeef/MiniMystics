import { optimizedAsset } from "./asset-url";

const art = (source: string) => optimizedAsset(source) ?? source;
const artMap = <T extends Record<string, string>>(assets: T): T => Object.fromEntries(
  Object.entries(assets).map(([key, value]) => [key, art(value)]),
) as T;

export const LOGO_ART = art("/logo/logo.png");

export const REWARD_ART = {
  coins: art("/art/rewards/coins.png"),
  xp: art("/art/rewards/xp.png"),
  coinBoost: art("/art/rewards/coin-boost.png"),
  xpBoost: art("/art/rewards/xp-boost.png"),
} as const;

export const PACK_ART: Record<string, string> = artMap({
  standard: "/art/packs/standard.png",
  "random-order": "/art/packs/random-order.png",
  void: "/art/packs/void.png",
  handler: "/art/packs/handler.png",
  "Agespire": "/art/packs/agespire.png",
  "First Spark": "/art/packs/first-spark.png",
  "Moonveil": "/art/packs/moonveil.png",
  "Order of the Star": "/art/packs/order-of-the-star.png",
  "Sovereign Order": "/art/packs/sovereign-order.png",
  "Stargate": "/art/packs/stargate.png",
  "Starwatch": "/art/packs/starwatch.png",
  "Sunspire": "/art/packs/sunspire.png",
  "Verdant Dawn": "/art/packs/verdant-dawn.png",
  "Worldforge": "/art/packs/worldforge.png",
});

export const OPPONENT_ART: Record<string, string> = artMap({
  rookie: "/art/opponents/lio-lowlands.png",
  forge: "/art/opponents/mara-ironhand.png",
  gale: "/art/opponents/aster-gale.png",
  veil: "/art/opponents/nox-moonveil.png",
  regent: "/art/opponents/silver-regent.png",
  fallen: "/art/opponents/arch-fallen.png",
});

export const ORDER_ART: Record<string, string> = artMap({
  "Agespire": "/art/orders/order_agespire.png",
  "First Spark": "/art/orders/order_firstspark.png",
  "Moonveil": "/art/orders/order_moonveil.png",
  "Order of the Star": "/art/orders/order_star.png",
  "Sovereign Order": "/art/orders/order_sovereign.png",
  "Stargate": "/art/orders/order_stargate.png",
  "Starwatch": "/art/orders/order_starwatch.png",
  "Sunspire": "/art/orders/order_sunspire.png",
  "Verdant Dawn": "/art/orders/order_verdantdawn.png",
  "Worldforge": "/art/orders/order_worldforge.png",
  "Void": "/art/orders/order_void.png",
});

export const ORDER_COLORS: Record<string, string> = {
  Agespire: "#28a6b8",
  "First Spark": "#f2c14e",
  Moonveil: "#9864d8",
  "Order of the Star": "#8d4de8",
  "Sovereign Order": "#d83b32",
  Stargate: "#2476d0",
  Starwatch: "#3288c7",
  Sunspire: "#ed842d",
  "Verdant Dawn": "#58a64a",
  Worldforge: "#9aa0a8",
  Void: "#662e8f",
};

export const ALLEGIANCE_ART: Record<string, string> = artMap({
  Ascendant: "/art/allegiances/ascendant.png",
  Mortalborn: "/art/allegiances/mortalborn.png",
  Mortalbound: "/art/allegiances/mortalborn.png",
  Unbound: "/art/allegiances/unbound.png",
  Voidbound: "/art/allegiances/voidbound.png",
});

export const PROFILE_AVATARS = [
  { id: "lio", name: "Lio", path: "/art/opponents/lio-lowlands.png" },
  { id: "mara", name: "Mara", path: "/art/opponents/mara-ironhand.png" },
  { id: "aster", name: "Aster", path: "/art/opponents/aster-gale.png" },
  { id: "nox", name: "Nox", path: "/art/opponents/nox-moonveil.png" },
  { id: "regent", name: "Silver Regent", path: "/art/opponents/silver-regent.png" },
  { id: "fallen", name: "The Fallen", path: "/art/opponents/arch-fallen.png" },
] as const;

export const RANK_ART: Record<string, string> = artMap({
  Wild: "/art/rank/wild.png",
  Hunter: "/art/rank/hunter.png",
  Predator: "/art/rank/predator.png",
  Prime: "/art/rank/prime.png",
  Alpha: "/art/rank/alpha.png",
  Apex: "/art/rank/apex.png",
});

export const BATTLE_ART: Record<string, string> = {
  "Lio of the Lowlands": "/art/backgrounds/battle-verdant.webp",
  "Mara Ironhand": "/art/backgrounds/battle-worldforge.webp",
  "Aster Gale": "/art/backgrounds/battle-astral.webp",
  "Nox of Moonveil": "/art/backgrounds/battle-void.webp",
  "The Silver Regent": "/art/backgrounds/battle-astral.webp",
  "Arch, The Fallen": "/art/backgrounds/battle-void.webp",
};

export const COMING_SOON_ART = artMap({
  Marketplace: "/art/coming%20soon/marketplace.png",
  Trading: "/art/coming%20soon/trading.png",
});
