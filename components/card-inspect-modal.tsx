"use client";

import { useEffect } from "react";
import { Clock3, Dices, Shield, Sparkles, Swords, X } from "lucide-react";
import { definitionFor } from "@/lib/client-state";
import { ALLEGIANCE_ART, ORDER_ART, ORDER_COLORS } from "@/lib/art";

export function CardInspectModal({ definitionId, ownedCount, onClose }: { definitionId: string; ownedCount: number; onClose: () => void }) {
  const card = definitionFor(definitionId);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  if (!card) return null;
  const mystic = "power" in card ? card : null;
  const handler = "activationRoll" in card ? card : null;
  const factionArt = ORDER_ART[card.order] ?? ALLEGIANCE_ART[card.allegiance];

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="card-inspect" role="dialog" aria-modal="true" aria-labelledby="card-inspect-title" style={{ "--order-color": ORDER_COLORS[card.order] ?? "#D7A93B" } as React.CSSProperties}>
      <button className="modal-close icon-button" onClick={onClose} aria-label="Close card details"><X /></button>
      <div className="inspect-art">
        {card.image ? <img src={card.image} alt={`${card.name} card`} /> : <div className="artwork-needed">Artwork needed</div>}
      </div>
      <div className="inspect-details">
        <div className="inspect-heading">
          {factionArt ? <img src={factionArt} alt="" /> : null}
          <div><span>{mystic ? "MYSTIC" : "HANDLER"} · {card.rarity}</span><h2 id="card-inspect-title">{card.name}</h2><p>{card.order} · {card.allegiance}</p></div>
        </div>
        <dl className="detail-grid">
          <div><dt>Card ID</dt><dd>{card.id}</dd></div>
          <div><dt>Owned</dt><dd>{ownedCount} {ownedCount === 1 ? "copy" : "copies"}</dd></div>
          <div><dt>Order</dt><dd>{card.order}</dd></div>
          <div><dt>Allegiance</dt><dd>{card.allegiance}</dd></div>
          <div><dt>Rarity</dt><dd>{card.rarity}</dd></div>
        </dl>
        {mystic ? <>
          <div className="inspect-stats">
            <span><Sparkles /><small>POWER</small><strong>{mystic.power}</strong></span>
            <span><Shield /><small>DEFENSE</small><strong>{mystic.defense}</strong></span>
            <span><Swords /><small>ATTACK</small><strong>{mystic.baseAttack}</strong></span>
          </div>
          <div className="move-list"><h3>Battle moves</h3>{mystic.moves.map((move) => <article key={move.name}>
            <div><strong>{move.name}</strong><span><Dices />{move.minimumRoll ? `${move.minimumRoll}+` : move.exactRoll ?? move.requiredRoll}<Clock3 />Cooldown {move.cooldown}</span></div>
            <p>{move.rawText}</p>
          </article>)}</div>
        </> : <>
          <div className="inspect-stats handler-stats"><span><Dices /><small>ACTIVATION</small><strong>{handler?.exactRoll ? handler.activationRoll : `${handler?.activationRoll}+`}</strong></span><span><Sparkles /><small>USES</small><strong>{handler?.maxUses}</strong></span><span><Clock3 /><small>DURATION</small><strong>{handler?.duration || "Instant"}</strong></span></div>
          <div className="move-list"><h3>Handler effect</h3><article><div><strong>{handler?.effectType}</strong><span>Targets {handler?.target}</span></div><p>{handler?.effect}</p></article></div>
        </>}
      </div>
    </section>
  </div>;
}
