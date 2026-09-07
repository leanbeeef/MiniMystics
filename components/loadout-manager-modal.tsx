"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Pencil, Shield, Sparkles, Star, Swords, Trash2, X } from "lucide-react";
import { useGame } from "./game-provider";
import { CardTile } from "./card-tile";
import { FormationPreview } from "./formation-preview";
import { catalog, type Loadout } from "@/lib/client-state";
import { computeOrderSynergies, orderCounts } from "@/lib/game/order-matchups";
import { levelBonusPercent } from "@/lib/game/economy";
import { roundHalfUp } from "@/lib/game/rounding";
import { ORDER_COLORS } from "@/lib/art";

function leveledStat(printed: number, level: number) {
  return roundHalfUp(printed * (1 + levelBonusPercent(level) / 100));
}

export function LoadoutManagerModal({ editLoadoutId, onClose }: { editLoadoutId?: string | null; onClose: () => void }) {
  const { state, saveLoadout, deleteLoadout, setActiveLoadout } = useGame();
  const [size, setSize] = useState<3 | 5 | 8>(5);
  const [name, setName] = useState("Fivefold Line");
  const [mystics, setMystics] = useState<string[]>([]);
  const [handlers, setHandlers] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const ownedMystics = state.ownedCards.filter((owned) => catalog.mystics.some((card) => card.id === owned.definitionId));
  const ownedHandlers = state.ownedCards.filter((owned) => catalog.handlers.some((card) => card.id === owned.definitionId));

  const editLoadout = (loadout: Loadout) => { setEditingId(loadout.id); setName(loadout.name); setSize(loadout.size); setMystics([...loadout.mysticIds]); setHandlers([...loadout.handlerIds]); };
  const resetEditor = () => { setEditingId(null); setName("Fivefold Line"); setSize(5); setMystics([]); setHandlers([]); };

  useEffect(() => { setMystics((current) => current.slice(0, size)); }, [size]);
  useEffect(() => { document.body.classList.add("modal-open"); return () => document.body.classList.remove("modal-open"); }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useEffect(() => {
    if (!editLoadoutId) return;
    const requested = state.loadouts.find((loadout) => loadout.id === editLoadoutId);
    if (requested) editLoadout(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLoadoutId]);

  const toggle = (id: string, list: string[], setList: (next: string[]) => void, max: number) => setList(list.includes(id) ? list.filter((item) => item !== id) : list.length < max ? [...list, id] : list);
  const save = () => { saveLoadout({ id: editingId ?? undefined, name, size, mysticIds: mystics, handlerIds: handlers }); resetEditor(); };

  const selectedMysticCards = mystics.map((ownedId) => {
    const owned = state.ownedCards.find((item) => item.id === ownedId);
    const definition = owned ? catalog.mystics.find((card) => card.id === owned.definitionId) : undefined;
    return owned && definition ? { owned, definition } : null;
  }).filter((item): item is { owned: typeof state.ownedCards[number]; definition: (typeof catalog.mystics)[number] } => Boolean(item));

  const orders = selectedMysticCards.map((item) => item.definition.order);
  const allegianceTotals = orderCounts(selectedMysticCards.map((item) => item.definition.allegiance));
  const orderTotals = orderCounts(orders);
  const synergies = computeOrderSynergies(orders);
  const totals = selectedMysticCards.reduce((sum, item) => ({
    power: sum.power + leveledStat(item.definition.power, item.owned.level),
    atk: sum.atk + leveledStat(item.definition.baseAttack, item.owned.level),
    def: sum.def + leveledStat(item.definition.defense, item.owned.level),
  }), { power: 0, atk: 0, def: 0 });

  const ordersOf = (ids: string[]) => ids.map((cardId) => { const owned = state.ownedCards.find((item) => item.id === cardId); return owned && catalog.mystics.find((card) => card.id === owned.definitionId)?.order; }).filter(Boolean) as string[];

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="loadout-modal" role="dialog" aria-modal="true" aria-label="Loadout manager">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close loadout manager"><X /></button>
        <header className="loadout-modal-head"><span>BATTLE PREP</span><h2>Loadout manager</h2><p>Build formations from individual owned card instances, then set one active per battle size.</p></header>
        <div className="loadout-modal-body">
          <section className="panel builder">
            <div className="builder-top"><label>Loadout name<input value={name} onChange={(e) => setName(e.target.value)} /></label><div><span>Battle size</span><div className="segmented small">{([3, 5, 8] as const).map((value) => <button key={value} className={size === value ? "active" : ""} onClick={() => setSize(value)}>{value}</button>)}</div></div></div>
            <div className="selected-lineup">
              <div className="zone-label"><span>{editingId ? "EDITING FORMATION" : "SELECTED LINEUP"}</span><strong>{mystics.length}/{size} Mystics · {handlers.length}/3 Handlers</strong></div>
              <div className="lineup-slots">{Array.from({ length: size }, (_, index) => { const owned = ownedMystics.find((item) => item.id === mystics[index]); return owned ? <CardTile key={owned.id} compact definitionId={owned.definitionId} level={owned.level} selected onClick={() => toggle(owned.id, mystics, setMystics, size)} /> : <span className="empty-slot" key={index}>+</span>; })}</div>
            </div>
            <h3>Available Mystics <span>{mystics.length}/{size}</span></h3>
            <div className="picker-row">{ownedMystics.map((owned) => <CardTile key={owned.id} compact definitionId={owned.definitionId} level={owned.level} selected={mystics.includes(owned.id)} onClick={() => toggle(owned.id, mystics, setMystics, size)} />)}</div>
            <h3>Handlers <span>{handlers.length}/3</span></h3>
            <div className="picker-row">{ownedHandlers.map((owned) => <CardTile key={owned.id} compact definitionId={owned.definitionId} selected={handlers.includes(owned.id)} onClick={() => toggle(owned.id, handlers, setHandlers, 3)} />)}</div>
            <div className="builder-actions"><button className="button primary" disabled={mystics.length !== size || !name.trim()} onClick={save}>{editingId ? "Update formation" : "Save formation"} <Check /></button>{editingId ? <button className="button ghost" onClick={resetEditor}>Cancel edit</button> : null}</div>
          </section>

          <aside className="loadout-composition">
            <h3>Formation composition</h3>
            <div className="composition-totals">
              <span><Sparkles /><small>POWER</small><strong>{totals.power}</strong></span>
              <span><Swords /><small>ATK</small><strong>{totals.atk}</strong></span>
              <span><Shield /><small>DEF</small><strong>{totals.def}</strong></span>
            </div>
            {Object.keys(synergies).length ? <><h4>Order Synergy</h4><div className="synergy-row">{Object.entries(synergies).map(([order, percent]) => <span key={order} style={{ "--order-color": ORDER_COLORS[order] ?? "#D7A93B" } as React.CSSProperties}><Sparkles />{order} <b>+{percent}% ATK</b></span>)}</div></> : null}
            {Object.keys(orderTotals).length ? <><h4>Order composition</h4><ul className="composition-list">{Object.entries(orderTotals).sort(([, a], [, b]) => b - a).map(([order, count]) => <li key={order}><span style={{ "--order-color": ORDER_COLORS[order] ?? "#D7A93B" } as React.CSSProperties} className="composition-dot" />{order}<b>×{count}</b></li>)}</ul></> : null}
            {Object.keys(allegianceTotals).length ? <><h4>Allegiance composition</h4><ul className="composition-list">{Object.entries(allegianceTotals).sort(([, a], [, b]) => b - a).map(([allegiance, count]) => <li key={allegiance}>{allegiance}<b>×{count}</b></li>)}</ul></> : null}
          </aside>

          <aside className="saved-list">
            <h2>Your formations</h2>
            {state.loadouts.length ? state.loadouts.map((loadout) => <article className={`saved-loadout ${editingId === loadout.id ? "editing" : ""} ${loadout.active ? "is-active" : ""}`} key={loadout.id}>
              <header>
                <span className="formation-icon">{loadout.size}</span>
                <div><strong>{loadout.name}</strong><small>{loadout.mysticIds.length} Mystics · {loadout.handlerIds.length} Handlers</small></div>
                <button className={loadout.active ? "active" : ""} onClick={() => setActiveLoadout(loadout.id)} aria-label={loadout.active ? `${loadout.name} is active` : `Set ${loadout.name} active`} title={loadout.active ? "Active for this battle size" : "Set as active loadout for this battle size"}><Star /></button>
                <button onClick={() => editLoadout(loadout)} aria-label={`Edit ${loadout.name}`} title="Edit formation"><Pencil /></button>
                <button onClick={() => { deleteLoadout(loadout.id); if (editingId === loadout.id) resetEditor(); }} aria-label={`Delete ${loadout.name}`} title="Delete formation"><Trash2 /></button>
              </header>
              <FormationPreview ownedCards={state.ownedCards} mysticIds={loadout.mysticIds} handlerIds={loadout.handlerIds} size={loadout.size} />
              {Object.keys(computeOrderSynergies(ordersOf(loadout.mysticIds))).length ? <div className="synergy-row">{Object.entries(computeOrderSynergies(ordersOf(loadout.mysticIds))).map(([order, percent]) => <span key={order} style={{ "--order-color": ORDER_COLORS[order] ?? "#D7A93B" } as React.CSSProperties}><Sparkles />{order} <b>+{percent}%</b></span>)}</div> : null}
            </article>) : <p className="empty-hint">No formations yet. Select exactly the required number of Mystics, then save.</p>}
          </aside>
        </div>
      </section>
    </div>,
    document.body,
  );
}
