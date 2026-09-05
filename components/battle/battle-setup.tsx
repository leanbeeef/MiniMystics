"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Dices, Pencil, Plus, Shield, Swords, WandSparkles } from "lucide-react";
import { useGame } from "../game-provider";
import { CardTile } from "../card-tile";
import { FormationPreview } from "../formation-preview";
import { BATTLE_ART, OPPONENT_ART } from "@/lib/art";
import { CAMPAIGN, catalog } from "@/lib/client-state";

export function BattleSetup({ opponentId }: { opponentId: string }) {
  const { state, startBattle } = useGame();
  const opponent = CAMPAIGN.find((item) => item.id === opponentId);
  const ownedMystics = useMemo(() => state.ownedCards.filter((owned) => catalog.mystics.some((card) => card.id === owned.definitionId)), [state.ownedCards]);
  const ownedHandlers = useMemo(() => state.ownedCards.filter((owned) => catalog.handlers.some((card) => card.id === owned.definitionId)), [state.ownedCards]);
  const validLoadouts = useMemo(() => opponent ? state.loadouts.filter((loadout) => loadout.size === opponent.size && loadout.mysticIds.length === opponent.size && loadout.mysticIds.every((id) => ownedMystics.some((card) => card.id === id))) : [], [opponent, state.loadouts, ownedMystics]);
  const [mode, setMode] = useState<string>(() => validLoadouts[0]?.id ?? "random");
  const [customMystics, setCustomMystics] = useState<string[]>(() => opponent ? ownedMystics.slice(0, opponent.size).map((card) => card.id) : []);
  const [customHandlers, setCustomHandlers] = useState<string[]>(() => ownedHandlers.slice(0, 3).map((card) => card.id));

  if (!opponent) return <div className="page battle-setup-missing"><h1>Encounter not found</h1><Link className="button primary" href="/campaign">Return to campaign</Link></div>;

  const selectedLoadout = validLoadouts.find((loadout) => loadout.id === mode);
  const previewMystics = mode === "custom" ? customMystics : selectedLoadout?.mysticIds ?? [];
  const previewHandlers = mode === "custom" ? customHandlers : selectedLoadout?.handlerIds ?? [];
  const customValid = customMystics.length === opponent.size;
  const toggle = (id: string, current: string[], limit: number, update: (next: string[]) => void) => update(current.includes(id) ? current.filter((item) => item !== id) : current.length < limit ? [...current, id] : current);
  const launch = () => {
    if (mode === "random") startBattle(opponent.id, { random: true });
    else if (mode === "custom" && customValid) startBattle(opponent.id, { mysticIds: customMystics, handlerIds: customHandlers });
    else if (selectedLoadout) startBattle(opponent.id, { loadoutId: selectedLoadout.id });
  };
  const style = { "--battle-setup-art": `url("${BATTLE_ART[opponent.name]}")` } as React.CSSProperties;

  return <div className="battle-setup" style={style}>
    <div className="battle-setup-backdrop" />
    <header className="battle-setup-header">
      <Link href="/campaign"><ArrowLeft />Campaign</Link>
      <div><span>PREPARE FOR BATTLE</span><h1>Choose your formation</h1><p>{opponent.size} Mystics enter. Up to 3 Handlers may support them.</p></div>
      <div className="battle-setup-opponent"><img src={OPPONENT_ART[opponent.id]} alt="" /><span><small>OPPONENT</small><strong>{opponent.name}</strong><em>{opponent.difficulty} · {opponent.style}</em></span></div>
    </header>

    <div className="battle-setup-layout">
      <aside className="battle-formation-options">
        <h2>Your formations</h2>
        <button type="button" className={mode === "random" ? "active" : ""} onClick={() => setMode("random")}><span><Dices /></span><span><strong>Random formation</strong><small>Choose from all eligible owned cards</small></span><ChevronRight /></button>
        {validLoadouts.map((loadout) => <button type="button" className={mode === loadout.id ? "active" : ""} key={loadout.id} onClick={() => setMode(loadout.id)}><b>{loadout.size}</b><span><strong>{loadout.name}</strong><small>{loadout.mysticIds.length} Mystics · {loadout.handlerIds.length} Handlers</small></span><ChevronRight /></button>)}
        <button type="button" className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}><span><Plus /></span><span><strong>Choose individual cards</strong><small>Build a temporary formation</small></span><ChevronRight /></button>
        {!validLoadouts.length ? <p>No saved {opponent.size}-card formations yet. You can choose cards now or use random.</p> : null}
      </aside>

      <main className="battle-formation-stage">
        <div className="battle-formation-title"><div><span>{mode === "random" ? "RANDOM DRAW" : mode === "custom" ? "CUSTOM LINEUP" : "SAVED FORMATION"}</span><h2>{mode === "random" ? "Fate decides" : mode === "custom" ? "Choose your cards" : selectedLoadout?.name}</h2></div>{selectedLoadout ? <Link href={`/loadouts?edit=${encodeURIComponent(selectedLoadout.id)}`}><Pencil />Edit formation</Link> : null}</div>
        <FormationPreview ownedCards={state.ownedCards} mysticIds={previewMystics} handlerIds={previewHandlers} size={opponent.size} concealed={mode === "random"} />
        {mode === "random" ? <div className="battle-random-copy"><Dices /><p><strong>A fresh lineup each battle</strong><span>{opponent.size} Mystics and up to 3 Handlers will be selected from your collection when battle begins.</span></p></div> : null}
        {mode === "custom" ? <div className="battle-custom-picker">
          <div className="battle-picker-heading"><span><Swords />Mystics</span><strong>{customMystics.length}/{opponent.size}</strong></div>
          <div className="picker-row">{ownedMystics.map((owned) => <CardTile key={owned.id} compact definitionId={owned.definitionId} selected={customMystics.includes(owned.id)} onClick={() => toggle(owned.id, customMystics, opponent.size, setCustomMystics)} />)}</div>
          <div className="battle-picker-heading"><span><WandSparkles />Handlers</span><strong>{customHandlers.length}/3</strong></div>
          <div className="picker-row">{ownedHandlers.length ? ownedHandlers.map((owned) => <CardTile key={owned.id} compact definitionId={owned.definitionId} selected={customHandlers.includes(owned.id)} onClick={() => toggle(owned.id, customHandlers, 3, setCustomHandlers)} />) : <p>No Handler cards owned.</p>}</div>
        </div> : null}
        <footer className="battle-setup-actions"><span><Shield />Your choice is locked when battle begins.</span><button className="button primary" disabled={mode === "custom" && !customValid} onClick={launch}>Begin battle <Swords /></button></footer>
      </main>
    </div>
  </div>;
}
