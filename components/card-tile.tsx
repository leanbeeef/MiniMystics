"use client";

import { Shield, Sparkles, Swords } from "lucide-react";
import { levelBonusPercent } from "@/lib/game/economy";
import { roundHalfUp } from "@/lib/game/rounding";
import { definitionFor } from "@/lib/client-state";
import { ALLEGIANCE_ART, ORDER_ART, ORDER_COLORS } from "@/lib/art";

export function CardTile({ definitionId, level, artwork, selected, compact, onClick, footer }: { definitionId: string; level?: number; artwork?: string | null; selected?: boolean; compact?: boolean; onClick?: () => void; footer?: React.ReactNode }) {
  const card = definitionFor(definitionId);
  if (!card) return null;
  const mystic = "power" in card ? card : null;
  const leveledStat = (printed: number) => roundHalfUp(printed * (1 + levelBonusPercent(level ?? 1) / 100));
  return (
    <button
      className={`card-tile rarity-${card.rarity.toLowerCase()} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onClick}
      type="button"
      style={{ "--order-color": ORDER_COLORS[card.order] ?? "#D7A93B" } as React.CSSProperties}
      aria-pressed={onClick ? selected : undefined}
    >
      <span className="card-art">{artwork ?? card.image ? <img src={artwork ?? card.image ?? ""} alt="" loading="lazy" decoding="async" /> : <span className="handler-mark">{card.name.slice(0, 1)}</span>}<span className="rarity-pip" />{mystic && level ? <span className="card-level-badge">Lv.{level}</span> : null}{(ORDER_ART[card.order] ?? ALLEGIANCE_ART[card.allegiance]) ? <img className="card-faction-mark" src={ORDER_ART[card.order] ?? ALLEGIANCE_ART[card.allegiance]} alt="" loading="lazy" decoding="async" /> : null}</span>
      <span className="card-copy"><span className="card-kicker">{mystic ? card.order : "Handler"}</span><strong>{card.name}</strong><span className="card-rarity">{card.rarity}</span></span>
      {mystic && !compact ? <span className="stat-row"><span><Sparkles />{leveledStat(mystic.power)}</span><span><Shield />{leveledStat(mystic.defense)}</span><span><Swords />{leveledStat(mystic.baseAttack)}</span></span> : null}
      {footer ? <span className="card-footer">{footer}</span> : null}
    </button>
  );
}
