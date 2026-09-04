# Mini Mystics data import report

The importer reads `mini_mystics.csv` and `handlers.csv`, parses every Mystic move into a structured object, copies matched artwork into `public/cards`, and writes `lib/data/cards.generated.json`.

## Source summary

- 100 Mystic definitions across 10 Orders.
- 9 Handler definitions.
- Mystic columns: `MM #`, `Name`, `Order`, `Allegiance`, `Rarity`, `Power`, `Def`, `Base Attack`, `Moves`.
- Handler columns: `Handler #`, `Name`, `Allegiance`, `Order`, `Rarity`, activation fields, effect fields, usage fields, target, artwork, and notes.
- Mystic source rarities are Wild through Alpha. There are currently no Apex Mystics in the CSV.
- Handler rarities include Alpha, Apex, and six `TBD` values. `TBD` is preserved as `sourceRarity` and displayed as `Unassigned`; it is never silently mapped to a real rarity.
- Mystic and Handler art is matched by normalized name with an explicit alias map for filename differences. All nine supplied Handler cards under `public/cards/Handlers` are included.

## Moves requiring rules review

These effects are preserved verbatim, marked `needsReview`, and disabled in the current battle action panel instead of receiving invented behavior:

- Coral — `Current Curl: 6 = half-power second attack`
- Gravemaw — `Consume: 6 = heal half damage dealt`
- Kairo — `Focus Kata: 6 = next attack x2`
- Cactus Jack — `Prickly Guard: 6 = attacker takes 10`
- Sweep — `Sweep Away: 6 = remove DEF bonus`
- Scoutwing — `Recon: 6 = next attack +12`
- Flicker — `Charge: 6 = next attack +10`
- Whimsy — `Switcheroo: 6 = swap ATK and DEF bonuses`
- Doorbit — `Shortcut: 6 = attack before opponent next turn`
- All damage-block, damage-reduction, reflected-damage, missed-attack, skipped-turn, and enemy-ATK-debuff text is parsed but held for a later executor pass because the CSV does not state all timing/stacking details.

Run `npm run data:import` after changing either CSV. Malformed rows fail with the filename and row number. Review warnings are embedded in the generated catalog and printed as a count.
