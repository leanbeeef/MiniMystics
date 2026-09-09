"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, FolderPlus, X } from "lucide-react";
import { useGame } from "./game-provider";
import { artworkForOwnedCard } from "@/lib/client-state";
import { CardTile } from "./card-tile";

export function BinderManagerModal({ onClose }: { onClose: () => void }) {
  const { state, createBinder, renameBinder, toggleBinderCard } = useGame();
  const [name, setName] = useState("");
  const [active, setActive] = useState(state.binders[0]?.id ?? "");
  const binder = state.binders.find((item) => item.id === active);

  useEffect(() => { document.body.classList.add("modal-open"); return () => document.body.classList.remove("modal-open"); }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useEffect(() => { if (!active && state.binders[0]) setActive(state.binders[0].id); }, [active, state.binders]);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="binder-modal" role="dialog" aria-modal="true" aria-label="Binder manager">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close binder manager"><X /></button>
        <header className="loadout-modal-head">
          <span>PERSONAL ARCHIVE</span>
          <h2>Binders</h2>
          <p>Organize individual owned cards into named binders. Tap a card to add or remove it.</p>
        </header>
        <form className="inline-form binder-create-form" onSubmit={(event) => { event.preventDefault(); createBinder(name); setName(""); }}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New binder name" />
          <button className="button primary" type="submit"><FolderPlus />Create</button>
        </form>
        {state.binders.length ? <div className="binder-layout">
          <aside className="binder-tabs">{state.binders.map((item) => <button className={item.id === active ? "active" : ""} key={item.id} onClick={() => setActive(item.id)}><Archive />{item.name}<small>{item.cardIds.length}</small></button>)}</aside>
          <section className="panel binder-content">
            {binder ? <>
              <div className="binder-title"><input value={binder.name} onChange={(event) => renameBinder(binder.id, event.target.value)} /><span>{binder.cardIds.length} cards filed</span></div>
              <div className="picker-row large">{state.ownedCards.map((owned) => <CardTile key={owned.id} definitionId={owned.definitionId} level={owned.level} artwork={artworkForOwnedCard(owned)} compact selected={binder.cardIds.includes(owned.id)} onClick={() => toggleBinderCard(binder.id, owned.id)} />)}</div>
            </> : null}
          </section>
        </div> : <div className="empty-state"><span><Archive /></span><h3>Create your first binder</h3><p>Name it, then file any owned card instances inside.</p></div>}
      </section>
    </div>,
    document.body,
  );
}
