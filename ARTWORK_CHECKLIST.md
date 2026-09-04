# Mini Mystics artwork checklist

All 100 Mystic card faces, all 9 Handler card faces, and the shared card back are present. New artwork can be added under `public/art/` using the paths below; lowercase kebab-case filenames will keep asset mapping predictable.

## Priority 1 — complete the current playable loop

### Reward card faces

Create these as complete portrait cards at **1024 × 1536 px**. Keep important details at least 70 px from every edge.

- `public/art/rewards/coins.png` — earned Coin reward; visible coin cache or treasury motif.
- `public/art/rewards/xp.png` — earned XP reward; luminous progression/rank motif.
- `public/art/rewards/coin-boost.png` — 2× Coins boost; doubled coin or mirrored treasury motif.
- `public/art/rewards/xp-boost.png` — 2× XP boost; doubled energy/progression motif.

The interface can add rarity treatment and numeric values, so the artwork should contain **no amount, rarity, duration, or text**.

### Pack artwork

Create portrait pack-wrapper art at **1200 × 1600 px**, with no price or odds text.

- `public/art/packs/standard.png`
- `public/art/packs/random-order.png`
- `public/art/packs/void.png`
- `public/art/packs/handler.png`
- `public/art/packs/order-of-the-star.png`
- `public/art/packs/verdant-dawn.png`
- `public/art/packs/first-spark.png`
- `public/art/packs/worldforge.png`
- `public/art/packs/sunspire.png`
- `public/art/packs/starwatch.png`
- `public/art/packs/moonveil.png`
- `public/art/packs/agespire.png`
- `public/art/packs/stargate.png`
- `public/art/packs/sovereign-order.png`

## Priority 2 — campaign identity

### AI opponent portraits

Create square portraits at **1024 × 1024 px**. Use a simple background and leave room around the head and shoulders for circular cropping.

- `public/art/opponents/lio-lowlands.png` — approachable young Handler; practical travel gear; neutral beginner rival.
- `public/art/opponents/mara-ironhand.png` — Worldforge-aligned veteran; durable armor; calm defensive presence.
- `public/art/opponents/aster-gale.png` — fast aerial scout; wind-tossed silhouette; confident aggressive rival.
- `public/art/opponents/nox-moonveil.png` — quiet Moonveil tactician; dreamlike shadow lighting; control specialist.
- `public/art/opponents/silver-regent.png` — formal Sovereign commander; silver regalia; disciplined finisher theme.
- `public/art/opponents/arch-fallen.png` — imposing Voidbound master; fractured crown motif; final-boss presence.

These are character portraits, not Handler cards, and should contain no frame, stats, or typography.

### Order crests

Create transparent PNG crests at **512 × 512 px** with bold silhouettes that remain readable at 24 px.

- `public/art/orders/order-of-the-star.png`
- `public/art/orders/verdant-dawn.png`
- `public/art/orders/first-spark.png`
- `public/art/orders/worldforge.png`
- `public/art/orders/sunspire.png`
- `public/art/orders/starwatch.png`
- `public/art/orders/moonveil.png`
- `public/art/orders/agespire.png`
- `public/art/orders/stargate.png`
- `public/art/orders/sovereign-order.png`
- `public/art/orders/voidbound.png` — allegiance crest used by Void-focused content.
- `public/art/orders/unbound.png` — neutral/unaffiliated crest.

## Priority 3 — world and atmosphere

Create wide, text-free scenes at **2400 × 1350 px**. Keep the middle 60% relatively low-detail so cards and controls stay readable over them.

- `public/art/backgrounds/command-room.webp` — neutral Handler table or archive used on the dashboard.
- `public/art/backgrounds/pack-chamber.webp` — sealed vault or ritual table used during pack opening.
- `public/art/backgrounds/battle-worldforge.webp` — stone-and-forge arena.
- `public/art/backgrounds/battle-verdant.webp` — overgrown dawn-lit arena.
- `public/art/backgrounds/battle-astral.webp` — star-lit convergence arena.
- `public/art/backgrounds/battle-void.webp` — restrained Void arena for late campaign battles.

## Priority 4 — later features

- `public/art/coming-soon/marketplace.webp` — wide 1600 × 900 px trading hall, empty of readable signage.
- `public/art/coming-soon/trading.webp` — wide 1600 × 900 px two-Handler exchange scene.
- `public/art/events/event-pack-template.png` — portrait 1200 × 1600 px event wrapper with a safe central area for future event emblems.
- `public/art/avatars/avatar-01.png` through `avatar-08.png` — square 512 × 512 px profile portraits with varied silhouettes.

## Shared art direction notes

- Export card faces and transparent crests as PNG; export large backgrounds as high-quality WebP.
- Avoid baked-in gameplay values, rarity labels, prices, pack odds, UI buttons, and long text.
- Keep lighting and contrast consistent with the existing card set, but separate illustration from card frames whenever the UI may need to crop it.
- Do not overwrite `public/cards/Mystics/back.png`; it is now the shared reveal back.
