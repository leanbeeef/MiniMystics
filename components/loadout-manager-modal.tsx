"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Filter, Pencil, Shield, Sparkles, Star, Swords, Trash2, X } from "lucide-react";
import { useGame } from "./game-provider";
import { CardTile } from "./card-tile";
import { FormationPreview } from "./formation-preview";
import { artworkForOwnedCard, catalog, definitionFor, type Loadout } from "@/lib/client-state";
import { computeOrderSynergies, orderCounts } from "@/lib/game/order-matchups";
import { levelBonusPercent } from "@/lib/game/economy";
import { roundHalfUp } from "@/lib/game/rounding";
import { ORDER_COLORS } from "@/lib/art";

function leveledStat(printed: number, level: number) {
  return roundHalfUp(printed * (1 + levelBonusPercent(level) / 100));
}

type PickerKind = "mystic" | "handler";

export function LoadoutManagerModal({ editLoadoutId, onClose }: { editLoadoutId?: string | null; onClose: () => void }) {
  const { state, saveLoadout, deleteLoadout, setActiveLoadout } = useGame();
  const [size, setSize] = useState<3 | 5 | 8>(5);
  const [name, setName] = useState("Fivefold Line");
  const [mystics, setMystics] = useState<string[]>([]);
  const [handlers, setHandlers] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOrder, setPickerOrder] = useState("all");
  const [pickerAllegiance, setPickerAllegiance] = useState("all");
  const [pickerRarity, setPickerRarity] = useState("all");
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

  const removeMystic = (id: string) => setMystics((current) => current.filter((item) => item !== id));
  const removeHandler = (id: string) => setHandlers((current) => current.filter((item) => item !== id));
  const save = () => { saveLoadout({ id: editingId ?? undefined, name, size, mysticIds: mystics, handlerIds: handlers }); resetEditor(); };

  const openPicker = (kind: PickerKind) => { setPickerQuery(""); setPickerOrder("all"); setPickerAllegiance("all"); setPickerRarity("all"); setPicker(kind); };
  const pickCard = (kind: PickerKind, ownedId: string) => {
    if (kind === "mystic") setMystics((current) => (current.length < size ? [...current, ownedId] : current));
    else setHandlers((current) => (current.length < 3 ? [...current, ownedId] : current));
    setPicker(null);
  };

  const pickerPool = useMemo(() => {
    const pool = picker === "mystic" ? ownedMystics.filter((owned) => !mystics.includes(owned.id)) : picker === "handler" ? ownedHandlers.filter((owned) => !handlers.includes(owned.id)) : [];
    return pool.filter((owned) => {
      const definition = definitionFor(owned.definitionId);
      if (!definition) return false;
      return (pickerOrder === "all" || definition.order === pickerOrder) && (pickerAllegiance === "all" || definition.allegiance === pickerAllegiance) && (pickerRarity === "all" || definition.rarity === pickerRarity) && definition.name.toLowerCase().includes(pickerQuery.toLowerCase());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker, ownedMystics, ownedHandlers, mystics, handlers, pickerOrder, pickerAllegiance, pickerRarity, pickerQuery]);
  const pickerCatalog = picker === "mystic" ? catalog.mystics : catalog.handlers;
  const pickerOrders = [...new Set(pickerCatalog.map((card) => card.order))];
  const pickerAllegiances = [...new Set(pickerCatalog.map((card) => card.allegiance))].sort();
  const pickerRarities = [...new Set(pickerCatalog.map((card) => card.rarity))];

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
        {picker ? (
          <div className="card-picker">
            <div className="card-picker-head">
              <button className="button ghost" onClick={() => setPicker(null)}><ArrowLeft />Back</button>
              <h3>Choose a {picker === "mystic" ? "Mystic" : "Handler"}</h3>
              <span>{picker === "mystic" ? `${mystics.length}/${size}` : `${handlers.length}/3`}</span>
            </div>
            <div className="filterbar collection-filters">
              <label className="search"><Filter /><input value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Find a card" autoFocus /></label>
              <select value={pickerOrder} onChange={(e) => setPickerOrder(e.target.value)}><option value="all">All Orders</option>{pickerOrders.map((o) => <option key={o}>{o}</option>)}</select>
              <select value={pickerAllegiance} onChange={(e) => setPickerAllegiance(e.target.value)}><option value="all">All allegiances</option>{pickerAllegiances.map((a) => <option key={a}>{a}</option>)}</select>
              <select value={pickerRarity} onChange={(e) => setPickerRarity(e.target.value)}><option value="all">All rarities</option>{pickerRarities.map((r) => <option key={r}>{r}</option>)}</select>
            </div>
            <div className="card-picker-grid">
              {pickerPool.length ? pickerPool.map((owned) => <CardTile key={owned.id} definitionId={owned.definitionId} level={picker === "mystic" ? owned.level : undefined} artwork={artworkForOwnedCard(owned)} onClick={() => pickCard(picker, owned.id)} />) : <p className="empty-hint">No cards match. Try a different filter, or open a pack to get more.</p>}
            </div>
          </div>
        ) : (
        <div className="loadout-modal-body">
          <section className="panel builder">
            <div className="builder-top"><label>Loadout name<input value={name} onChange={(e) => setName(e.target.value)} /></label><div><span>Battle size</span><div className="segmented small">{([3, 5, 8] as const).map((value) => <button key={value} className={size === value ? "active" : ""} onClick={() => setSize(value)}>{value}</button>)}</div></div></div>
            <div className="selected-lineup">
              <div className="zone-label"><span>MYSTICS</span><strong>{mystics.length}/{size}</strong></div>
              <div className="lineup-slots">{Array.from({ length: size }, (_, index) => { const owned = ownedMystics.find((item) => item.id === mystics[index]); return owned ? <CardTile key={owned.id} compact definitionId={owned.definitionId} level={owned.level} artwork={artworkForOwnedCard(owned)} selected onClick={() => removeMystic(owned.id)} /> : <button type="button" className="empty-slot" key={index} onClick={() => openPicker("mystic")} aria-label="Add a Mystic">+</button>; })}</div>
            </div>
            <div className="selected-lineup">
              <div className="zone-label"><span>{editingId ? "EDITING FORMATION · HANDLERS" : "HANDLERS"}</span><strong>{handlers.length}/3</strong></div>
              <div className="lineup-slots">{Array.from({ length: 3 }, (_, index) => { const owned = ownedHandlers.find((item) => item.id === handlers[index]); return owned ? <CardTile key={owned.id} compact definitionId={owned.definitionId} artwork={artworkForOwnedCard(owned)} selected onClick={() => removeHandler(owned.id)} /> : <button type="button" className="empty-slot" key={index} onClick={() => openPicker("handler")} aria-label="Add a Handler">+</button>; })}</div>
            </div>
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
        )}
      </section>
    </div>,
    document.body,
  );
}
