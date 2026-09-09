"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, Clock3, Coins, Dices, Gem, Hammer, Shield, Sparkles, Swords, TriangleAlert, X } from "lucide-react";
import { definitionFor, disposableDuplicate, type OwnedCard } from "@/lib/client-state";
import { useGame } from "./game-provider";
import { ALLEGIANCE_ART, ORDER_ART, ORDER_COLORS } from "@/lib/art";
import { LEVEL_UP_ESSENCE_COST, MAX_MYSTIC_LEVEL, RARITY_DISMANTLE_ESSENCE, RARITY_SELL_COINS, levelBonusPercent } from "@/lib/game/economy";
import { roundHalfUp } from "@/lib/game/rounding";

type ConfirmAction = { kind: "sell" | "dismantle"; ownedId: string; lastCopy: boolean };

export function CardInspectModal({ definitionId, ownedCards, onClose }: { definitionId: string; ownedCards: OwnedCard[]; onClose: () => void }) {
  const { state, sellDuplicate, dismantleCard, levelUpCard } = useGame();
  const card = definitionFor(definitionId);
  const mystic = card && "power" in card ? card : null;
  const handler = card && "allegiancePassive" in card ? card : null;
  const sorted = useMemo(() => [...ownedCards].sort((a, b) => b.level - a.level), [ownedCards]);
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const selected = ownedCards.find((owned) => owned.id === selectedId) ?? sorted[0];
  const duplicate = disposableDuplicate(ownedCards, selected?.id ?? "");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && (confirmAction ? setConfirmAction(null) : onClose());
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.classList.remove("modal-open"); };
  }, [onClose, confirmAction]);

  if (!card) return null;
  const factionArt = ORDER_ART[card.order] ?? ALLEGIANCE_ART[card.allegiance];
  const level = selected?.level ?? 1;
  const nextLevel = Math.min(MAX_MYSTIC_LEVEL, level + 1);
  const canLevel = Boolean(mystic) && level < MAX_MYSTIC_LEVEL;
  const cost = canLevel ? LEVEL_UP_ESSENCE_COST[nextLevel] : 0;
  const essenceOwned = mystic ? state.essence[mystic.order] ?? 0 : 0;
  const leveledStat = (printed: number, atLevel: number) => roundHalfUp(printed * (1 + levelBonusPercent(atLevel) / 100));

  const requestConfirm = (kind: "sell" | "dismantle") => { if (duplicate) setConfirmAction({ kind, ownedId: duplicate.id, lastCopy: false }); };
  const runConfirmed = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === "sell") sellDuplicate(confirmAction.ownedId); else dismantleCard(confirmAction.ownedId);
    const closing = ownedCards.length <= 1;
    setConfirmAction(null);
    if (closing) onClose();
  };
  const referencingLoadouts = confirmAction ? state.loadouts.filter((loadout) => loadout.mysticIds.includes(confirmAction.ownedId) || loadout.handlerIds.includes(confirmAction.ownedId)) : [];

  // Rendered via a portal straight to <body> so `position: fixed` always anchors to the true
  // viewport, regardless of any transform/filter on an ancestor (e.g. the page-transition wrapper)
  // that would otherwise turn this into a containing block and throw off centering/sizing.
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
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
          <div><dt>Owned</dt><dd>{ownedCards.length} {ownedCards.length === 1 ? "copy" : "copies"}</dd></div>
          <div><dt>Order</dt><dd>{card.order}</dd></div>
          <div><dt>Allegiance</dt><dd>{card.allegiance}</dd></div>
          <div><dt>Rarity</dt><dd>{card.rarity}</dd></div>
        </dl>
        {mystic ? <div className="inspect-columns">
          <div className="inspect-primary">
            {ownedCards.length > 1 ? <div className="inspect-copy-switcher" role="listbox" aria-label="Owned copies">
              {sorted.map((owned) => <button key={owned.id} type="button" role="option" aria-selected={owned.id === selected?.id} className={owned.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(owned.id)}>Lv.{owned.level}</button>)}
            </div> : null}
            <div className="inspect-stats">
              <span><Sparkles /><small>POWER</small><strong>{leveledStat(mystic.power, level)}</strong></span>
              <span><Shield /><small>DEFENSE</small><strong>{leveledStat(mystic.defense, level)}</strong></span>
              <span><Swords /><small>ATTACK</small><strong>{leveledStat(mystic.baseAttack, level)}</strong></span>
            </div>
            <div className="move-list"><h3>Battle moves</h3>{mystic.moves.map((move) => <article key={move.name}>
              <div><strong>{move.name}</strong><span><Dices />{move.requiredRoll}+<Clock3 />Cooldown {move.cooldown}</span></div>
              <p>{move.rawText.split("|").pop()?.trim()}</p>
            </article>)}</div>
          </div>
          <div className="inspect-secondary">
            <div className="inspect-actions">
              <div className="inspect-level-panel">
                <div className="level-panel-heading"><span>Level {level}{canLevel ? ` → ${nextLevel}` : " (MAX)"}</span></div>
                {canLevel ? <>
                  <div className="level-stat-preview">
                    <span>Power Score<b>{leveledStat(mystic.power, level)} → {leveledStat(mystic.power, nextLevel)}</b></span>
                    <span>DEF<b>{leveledStat(mystic.defense, level)} → {leveledStat(mystic.defense, nextLevel)}</b></span>
                    <span>Base ATK<b>{leveledStat(mystic.baseAttack, level)} → {leveledStat(mystic.baseAttack, nextLevel)}</b></span>
                  </div>
                  <div className="level-cost-row"><Gem /><span>{essenceOwned} / {cost} {card.order} Essence</span></div>
                  <button className="button primary" disabled={essenceOwned < cost} onClick={() => selected && levelUpCard(selected.id)}><ArrowUp />Level up</button>
                </> : <p>This Mystic has reached the maximum level.</p>}
              </div>
              <div className="inspect-duplicate-actions">
                <button className="button ghost" disabled={!duplicate} onClick={() => requestConfirm("sell")}><Coins />Sell duplicate</button>
                <button className="button ghost" disabled={!duplicate} onClick={() => requestConfirm("dismantle")}><Hammer />Dismantle for Essence</button>
              </div>
              <p>Only Level 1 duplicates can be sold or dismantled. Leveled cards are protected.</p>
            </div>
          </div>
        </div> : <div className="inspect-columns">
          <div className="inspect-primary">
            <div className="move-list"><h3>Handler passives</h3>
              <article><div><strong>{handler?.allegiancePassive.name}</strong><span>Targets {handler?.allegiancePassive.targetLabel}</span></div><p>{handler?.allegiancePassive.rawText}</p></article>
              <article><div><strong>{handler?.orderPassive.name}</strong><span>Targets {handler?.orderPassive.targetLabel}</span></div><p>{handler?.orderPassive.rawText}</p></article>
            </div>
          </div>
          <div className="inspect-secondary">
            <div className="inspect-actions">
              <div className="inspect-duplicate-actions">
                <button className="button ghost" disabled={!duplicate} onClick={() => requestConfirm("sell")}><Coins />Sell duplicate</button>
              </div>
            </div>
          </div>
        </div>}
      </div>
    </section>
    {confirmAction ? <div className="modal-backdrop confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmAction(null)}>
      <section className="confirm-panel" role="alertdialog" aria-modal="true" aria-label="Confirm action">
        <TriangleAlert />
        <h3>{confirmAction.kind === "sell" ? "Sell this copy?" : "Dismantle this copy?"}</h3>
        <p>{card.name} — Level 1 duplicate.{mystic ? " Your leveled copies will be kept." : ""}</p>
        <p>{confirmAction.kind === "sell" ? `You'll receive ${RARITY_SELL_COINS[card.rarity]} Coins.` : `You'll receive ${RARITY_DISMANTLE_ESSENCE[card.rarity as keyof typeof RARITY_DISMANTLE_ESSENCE]} ${card.order} Essence.`} This card copy will be permanently removed from your collection.</p>
        {confirmAction.lastCopy ? <p className="confirm-warning">This is your only copy of {card.name}.{referencingLoadouts.length ? ` It's used in: ${referencingLoadouts.map((loadout) => loadout.name).join(", ")}.` : ""}</p> : null}
        <div className="confirm-actions"><button className="button ghost" onClick={() => setConfirmAction(null)}>Cancel</button><button className="button primary" onClick={runConfirmed}>Confirm</button></div>
      </section>
    </div> : null}
  </div>,
    document.body,
  );
}
