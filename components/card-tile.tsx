"use client";

import { Shield, Sparkles, Swords } from "lucide-react";
import { definitionFor } from "@/lib/client-state";
import { ALLEGIANCE_ART, ORDER_ART, ORDER_COLORS } from "@/lib/art";

export function CardTile({ definitionId, selected, compact, onClick, footer }: { definitionId: string; selected?: boolean; compact?: boolean; onClick?: () => void; footer?: React.ReactNode }) {
  const card = definitionFor(definitionId);
  if (!card) return null;
  const mystic = "power" in card ? card : null;
  return (
    <button
      className={`card-tile rarity-${card.rarity.toLowerCase()} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onClick}
      type="button"
      style={{ "--order-color": ORDER_COLORS[card.order] ?? "#D7A93B" } as React.CSSProperties}
      aria-pressed={onClick ? selected : undefined}
    >
      <span className="card-art">{card.image ? <img src={card.image} alt="" /> : <span className="handler-mark">{card.name.slice(0, 1)}</span>}<span className="rarity-pip" />{(ORDER_ART[card.order] ?? ALLEGIANCE_ART[card.allegiance]) ? <img className="card-faction-mark" src={ORDER_ART[card.order] ?? ALLEGIANCE_ART[card.allegiance]} alt="" /> : null}</span>
      <span className="card-copy"><span className="card-kicker">{mystic ? card.order : "Handler"}</span><strong>{card.name}</strong><span className="card-rarity">{card.rarity}</span></span>
      {mystic && !compact ? <span className="stat-row"><span><Sparkles />{mystic.power}</span><span><Shield />{mystic.defense}</span><span><Swords />{mystic.baseAttack}</span></span> : null}
      {footer ? <span className="card-footer">{footer}</span> : null}
    </button>
  );
}
