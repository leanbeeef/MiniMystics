"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, Backpack, Boxes, Check, ChevronRight, Coins, Crown, Dices, Filter, FolderPlus, Heart, ImageOff, Layers3, LockKeyhole, MonitorCog, PackageOpen, ScrollText, Shield, Sparkles, Swords, Target, TimerReset, Trash2, Trophy, UsersRound, WandSparkles, Zap } from "lucide-react";
import { useGame } from "./game-provider";
import { CardTile } from "./card-tile";
import { CardInspectModal } from "./card-inspect-modal";
import { BattleView as RefinedBattleView } from "./battle/battle-view";
import { VFXManager, useVFX } from "./vfx/vfx-manager";
import { CAMPAIGN, catalog, definitionFor } from "@/lib/client-state";
import { xpForLevel } from "@/lib/game/rewards";
import { PACK_DEFINITIONS } from "@/lib/game/packs";
import { BATTLE_ART, COMING_SOON_ART, OPPONENT_ART, PACK_ART, REWARD_ART } from "@/lib/art";
import { RARITY_PACK_EFFECT } from "@/lib/vfx/presets";

const PageHead = ({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: React.ReactNode }) => <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{copy ? <p>{copy}</p> : null}</div>{action}</div>;
const Empty = ({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action?: React.ReactNode }) => <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p>{action}</div>;

export function DashboardView() {
  const { state, startBattle } = useGame();
  const unfinished = state.openings.find((opening) => !opening.complete);
  const mysticCount = state.ownedCards.filter((owned) => catalog.mystics.some((card) => card.id === owned.definitionId)).length;
  const progress = Math.min(100, Math.round(state.xp / xpForLevel(state.level) * 100));
  return <div className="page dashboard-page">
    <section className="command-hero">
      <div className="hero-copy"><span className="eyebrow">HANDLER COMMAND</span><h1>Your next battle<br />starts with a <em>choice.</em></h1><p>Pick any surviving Mystic. Read the field. Commit one action.</p><div className="hero-actions">{mysticCount >= 5 ? <button className="button primary" onClick={() => startBattle("forge")}>Quick battle <Swords /></button> : <Link className="button primary" href="/open">Open starter pack <PackageOpen /></Link>}<Link className="button ghost" href="/loadouts">Edit lineup <ChevronRight /></Link></div></div>
      <div className="featured-stack" aria-label="Featured collection cards">{state.ownedCards.slice(0, 3).map((owned, index) => <div className={`stack-card stack-${index}`} key={owned.id}><CardTile definitionId={owned.definitionId} /></div>)}</div>
      <div className="hero-rune" aria-hidden="true">✦</div>
    </section>
    {unfinished ? <Link className="starter-alert" href="/open"><span><PackageOpen /></span><div><small>PACK WAITING</small><strong>Finish revealing your {unfinished.name}</strong></div><ArrowRight /></Link> : null}
    <section className="dashboard-grid">
      <div className="panel progress-panel"><div className="panel-title"><span><Crown />HANDLER PROGRESS</span><b>LV {state.level}</b></div><div className="level-line"><strong>{state.xp}<small> XP</small></strong><span>{xpForLevel(state.level)} to next level</span></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="mini-stats"><span><b>{state.wins}</b> wins</span><span><b>{state.matches}</b> matches</span><span><b>{state.ownedCards.length}</b> cards</span></div></div>
      <div className="panel boost-panel"><div className="panel-title"><span><Zap />ACTIVE BOOSTS</span><Link href="/inventory">Manage</Link></div><BoostLine label="2× XP" matches={state.activeBoosts.xp?.matches} tone="violet" /><BoostLine label="2× Coins" matches={state.activeBoosts.coins?.matches} tone="gold" /></div>
      <div className="panel next-panel"><div className="panel-title"><span><Target />NEXT ENCOUNTER</span><small>EASY</small></div><h3>Mara Ironhand</h3><p>A steady Worldforge lineup. Bring exactly 5 Mystics.</p><button className="text-button" onClick={() => startBattle("forge")}>Enter encounter <ArrowRight /></button></div>
    </section>
    <section className="quick-grid"><Link href="/collection"><Layers3 /><span><strong>Collection</strong><small>{state.ownedCards.length} owned cards</small></span><ChevronRight /></Link><Link href="/packs"><PackageOpen /><span><strong>Pack shop</strong><small>Improve your lineup</small></span><ChevronRight /></Link><Link href="/campaign"><Trophy /><span><strong>Campaign</strong><small>{state.campaignWins.length} encounters cleared</small></span><ChevronRight /></Link></section>
  </div>;
}

function BoostLine({ label, matches, tone }: { label: string; matches?: number; tone: string }) { return <div className={`boost-line ${tone}`}><span><Zap /></span><div><strong>{matches ? label : `${label} inactive`}</strong><small>{matches ? `${matches} matches remaining` : "Activate a boost from inventory"}</small></div></div>; }

export function CollectionView() {
  const { state, sellDuplicate } = useGame(); const [kind, setKind] = useState("all"); const [rarity, setRarity] = useState("all"); const [order, setOrder] = useState("all"); const [allegiance, setAllegiance] = useState("all"); const [sort, setSort] = useState("name"); const [query, setQuery] = useState(""); const [inspectId, setInspectId] = useState<string | null>(null);
  const grouped = useMemo(() => state.ownedCards.reduce<Record<string, typeof state.ownedCards>>((acc, owned) => ((acc[owned.definitionId] ??= []).push(owned), acc), {}), [state.ownedCards]);
  const cards = Object.entries(grouped).filter(([id]) => { const card = definitionFor(id)!; const isMystic = "power" in card; return (kind === "all" || (kind === "mystic") === isMystic) && (rarity === "all" || card.rarity === rarity) && (order === "all" || card.order === order) && (allegiance === "all" || card.allegiance === allegiance) && card.name.toLowerCase().includes(query.toLowerCase()); }).sort(([a], [b]) => { const first = definitionFor(a)!; const second = definitionFor(b)!; if (sort === "order") return first.order.localeCompare(second.order) || first.name.localeCompare(second.name); if (sort === "rarity") return ["Apex", "Alpha", "Prime", "Predator", "Hunter", "Wild", "Unassigned"].indexOf(first.rarity) - ["Apex", "Alpha", "Prime", "Predator", "Hunter", "Wild", "Unassigned"].indexOf(second.rarity); return first.name.localeCompare(second.name); });
  return <div className="page"><PageHead eyebrow="THE ARCHIVE" title="Your collection" copy={`${state.ownedCards.length} individual card instances · ${Object.keys(grouped).length} unique definitions`} action={<Link href="/collections" className="button ghost">Open binders <ArrowRight /></Link>} />
    <div className="filterbar collection-filters"><label className="search"><Filter /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a card" /></label><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All card types</option><option value="mystic">Mystics</option><option value="handler">Handlers</option></select><select value={rarity} onChange={(e) => setRarity(e.target.value)}><option value="all">All rarities</option>{["Wild", "Hunter", "Predator", "Prime", "Alpha", "Apex", "Unassigned"].map((r) => <option key={r}>{r}</option>)}</select><select value={order} onChange={(e) => setOrder(e.target.value)}><option value="all">All Orders</option>{[...new Set(catalog.mystics.map((m) => m.order))].map((o) => <option key={o}>{o}</option>)}</select><select value={allegiance} onChange={(e) => setAllegiance(e.target.value)}><option value="all">All allegiances</option>{[...new Set([...catalog.mystics, ...catalog.handlers].map((card) => card.allegiance))].sort().map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Sort: Name</option><option value="rarity">Sort: Rarity</option><option value="order">Sort: Order</option></select></div>
    {cards.length ? <div className="collection-grid">{cards.map(([definitionId, copies]) => <CardTile key={definitionId} definitionId={definitionId} onClick={() => setInspectId(definitionId)} footer={<><b>×{copies.length}</b>{copies.length > 1 ? <span role="button" onClick={(event) => { event.stopPropagation(); sellDuplicate(copies.at(-1)!.id); }}><Coins /> Sell duplicate</span> : <small>First copy protected</small>}</>} />)}</div> : <Empty icon={<Layers3 />} title="No cards match" copy="Try a different filter or open a new pack." />}
    {inspectId ? <CardInspectModal definitionId={inspectId} ownedCount={grouped[inspectId]?.length ?? 0} onClose={() => setInspectId(null)} /> : null}
  </div>;
}

export function LoadoutsView() {
  const { state, saveLoadout, deleteLoadout } = useGame(); const [size, setSize] = useState<3 | 5 | 8>(5); const [name, setName] = useState("Fivefold Line"); const [mystics, setMystics] = useState<string[]>([]); const [handlers, setHandlers] = useState<string[]>([]);
  const ownedMystics = state.ownedCards.filter((owned) => catalog.mystics.some((card) => card.id === owned.definitionId)); const ownedHandlers = state.ownedCards.filter((owned) => catalog.handlers.some((card) => card.id === owned.definitionId));
  useEffect(() => { setMystics((current) => current.slice(0, size)); }, [size]);
  const toggle = (id: string, list: string[], setList: (next: string[]) => void, max: number) => setList(list.includes(id) ? list.filter((item) => item !== id) : list.length < max ? [...list, id] : list);
  return <div className="page"><PageHead eyebrow="BATTLE PREP" title="Saved loadouts" copy="Every lineup is made from individual owned card instances." />
    <div className="loadout-layout"><section className="panel builder"><div className="builder-top"><label>Loadout name<input value={name} onChange={(e) => setName(e.target.value)} /></label><div><span>Battle size</span><div className="segmented small">{([3, 5, 8] as const).map((value) => <button key={value} className={size === value ? "active" : ""} onClick={() => setSize(value)}>{value}</button>)}</div></div></div><div className="selected-lineup"><div className="zone-label"><span>SELECTED LINEUP</span><strong>{mystics.length}/{size} Mystics · {handlers.length}/3 Handlers</strong></div><div className="lineup-slots">{Array.from({ length: size }, (_, index) => { const owned = ownedMystics.find((item) => item.id === mystics[index]); return owned ? <CardTile key={owned.id} compact definitionId={owned.definitionId} selected onClick={() => toggle(owned.id, mystics, setMystics, size)} /> : <span className="empty-slot" key={index}>+</span>; })}</div></div><h3>Available Mystics <span>{mystics.length}/{size}</span></h3><div className="picker-row">{ownedMystics.map((owned) => <CardTile key={owned.id} compact definitionId={owned.definitionId} selected={mystics.includes(owned.id)} onClick={() => toggle(owned.id, mystics, setMystics, size)} />)}</div><h3>Handlers <span>{handlers.length}/3</span></h3><div className="picker-row">{ownedHandlers.map((owned) => <CardTile key={owned.id} compact definitionId={owned.definitionId} selected={handlers.includes(owned.id)} onClick={() => toggle(owned.id, handlers, setHandlers, 3)} />)}</div><button className="button primary" disabled={mystics.length !== size} onClick={() => { saveLoadout({ name, size, mysticIds: mystics, handlerIds: handlers }); setMystics([]); setHandlers([]); }}>Save valid loadout <Check /></button></section>
      <aside className="saved-list"><h2>Your formations</h2>{state.loadouts.length ? state.loadouts.map((loadout) => <div className="saved-loadout" key={loadout.id}><span className="formation-icon">{loadout.size}</span><div><strong>{loadout.name}</strong><small>{loadout.mysticIds.length} Mystics · {loadout.handlerIds.length} Handlers</small></div><button onClick={() => deleteLoadout(loadout.id)} aria-label="Delete loadout"><Trash2 /></button></div>) : <Empty icon={<Boxes />} title="No formations yet" copy="Select exactly the required number of Mystics, then save." />}</aside>
    </div>
  </div>;
}

export function CampaignView() {
  const { state, startBattle } = useGame();
  const campaignWins = state.campaignWins ?? [];
  const clearedCount = CAMPAIGN.filter((opponent) => campaignWins.includes(opponent.id)).length;
  const campaignComplete = clearedCount === CAMPAIGN.length;
  const progress = Math.round(clearedCount / CAMPAIGN.length * 100);
  const nextOpponent = CAMPAIGN.find((opponent) => !campaignWins.includes(opponent.id));
  return <div className="page campaign-page">
    <PageHead eyebrow="THE FIRST CONVERGENCE" title="Campaign path" copy="Face fixed rivals, learn their style, and unlock tougher encounters." />
    <section className={`campaign-progress-card ${campaignComplete ? "complete" : ""}`} aria-label={`Campaign progress: ${clearedCount} of ${CAMPAIGN.length} encounters cleared`}>
      <span className="campaign-progress-emblem">{campaignComplete ? <Trophy /> : <ScrollText />}</span>
      <div className="campaign-progress-copy"><small>{campaignComplete ? "CONVERGENCE MASTERED" : "CAMPAIGN PROGRESS"}</small><strong>{campaignComplete ? "Campaign complete" : `${clearedCount} of ${CAMPAIGN.length} rivals defeated`}</strong><p>{campaignComplete ? "Every rival has fallen. You can replay any encounter." : nextOpponent ? `Next: ${nextOpponent.name}` : "Continue the campaign."}</p></div>
      <b>{progress}%</b>
      <div className="campaign-progress-rail" style={{ "--campaign-progress": `${progress}%` } as React.CSSProperties}>
        <i aria-hidden="true" />
        <ol>{CAMPAIGN.map((opponent, index) => { const cleared = campaignWins.includes(opponent.id); const current = !campaignComplete && opponent.id === nextOpponent?.id; return <li key={opponent.id} className={`${cleared ? "cleared" : ""} ${current ? "current" : ""}`} title={`${opponent.name}: ${cleared ? "cleared" : "not cleared"}`}><span>{cleared ? <Check /> : index + 1}</span><small>{opponent.name.split(" ")[0]}</small></li>; })}</ol>
      </div>
    </section>
    <div className="campaign-path">{CAMPAIGN.map((opponent, index) => { const locked = state.level < opponent.level; const cleared = campaignWins.includes(opponent.id); const compatible = state.ownedCards.filter((owned) => catalog.mystics.some((m) => m.id === owned.definitionId)).length >= opponent.size; return <article className={`encounter ${locked ? "locked" : ""} ${cleared ? "cleared" : ""}`} key={opponent.id}><span className="path-index">{cleared ? <Check /> : index + 1}</span><div className="encounter-art"><img src={OPPONENT_ART[opponent.id]} alt="" /></div><div className="encounter-copy"><div className="encounter-status"><span className={`difficulty ${opponent.difficulty.toLowerCase()}`}>{opponent.difficulty}</span>{cleared ? <span className="cleared-label"><Check />Cleared</span> : null}</div><h2>{opponent.name}</h2><p>{opponent.style} playstyle · {opponent.size}-Mystic battle</p><small className={cleared ? "reward-claimed" : ""}><Coins />{cleared ? `First clear bonus claimed: ${opponent.reward}` : `First clear bonus: ${opponent.reward}`}</small></div>{locked ? <div className="lock-copy"><LockKeyhole />Unlocks at level {opponent.level}</div> : <button disabled={!compatible} className={`button ${cleared ? "ghost" : "primary"}`} onClick={() => startBattle(opponent.id)}>{compatible ? cleared ? "Replay" : "Challenge" : `Need ${opponent.size} Mystics`}<Swords /></button>}</article>; })}</div>
  </div>;
}

export function PacksView() {
  const { state, buyPack } = useGame(); const [order, setOrder] = useState(catalog.mystics[0].order);
  return <div className="page"><PageHead eyebrow="THE VAULT" title="Pack shop" copy="Every pack uses fixed, account-neutral odds. Premium currency never changes them." action={<div className="balance-chip"><Coins />{state.coins.toLocaleString()} Coins</div>} /><div className="pity-card"><span><Sparkles /></span><div><strong>Standard Alpha pity</strong><p>{state.pity}/9 packs opened without Alpha. Apex never resets this counter.</p></div><div className="pity-dots">{Array.from({ length: 9 }, (_, index) => <i className={index < state.pity ? "filled" : ""} key={index} />)}</div></div><div className="pack-grid">{PACK_DEFINITIONS.map((pack, index) => { const packArt = pack.id === "order" ? PACK_ART[order] : PACK_ART[pack.id]; return <article className={`pack-product pack-${index}`} key={pack.id}><div className="pack-box">{packArt ? <img src={packArt} alt={`${pack.name} wrapper`} /> : <div className="artwork-needed"><ImageOff /><span>Artwork needed</span><small>Order of the Star pack</small></div>}</div><div><span className="pack-theme">{pack.theme}</span><h2>{pack.name}</h2><p>{pack.description}</p>{pack.id === "order" ? <select value={order} onChange={(e) => setOrder(e.target.value)}>{[...new Set(catalog.mystics.map((m) => m.order))].map((item) => <option key={item}>{item}</option>)}</select> : null}<button className="button pack-buy" disabled={state.coins < pack.coinPrice} onClick={() => buyPack(pack.id, order)}><Coins />{pack.coinPrice}<span>{state.coins < pack.coinPrice ? "Not enough Coins" : "Open pack"}</span></button></div></article>; })}</div><div className="odds-note"><strong>Standard rarity odds</strong><span>Wild 53%</span><span>Hunter 27%</span><span>Predator 12%</span><span>Prime 5.5%</span><span>Alpha 2%</span><span>Apex 0.5%</span></div></div>;
}

export function OpeningView() {
  return <VFXManager scope="pack"><OpeningExperience /></VFXManager>;
}

function OpeningExperience() {
  const { state, reveal } = useGame();
  const { playPackEffect } = useVFX();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revealingAll, setRevealingAll] = useState(false);
  const opening = state.openings.find((item) => item.id === state.activeOpeningId) ?? state.openings[0];

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => playPackEffect("pack-open", { intensity: "low", audioHook: "pack_open" }), 180);
    return () => window.clearTimeout(timer);
  }, [opening?.id, playPackEffect]);

  if (!opening) return <div className="page"><PageHead eyebrow="PACK CHAMBER" title="No pack waiting" /><Empty icon={<PackageOpen />} title="The chamber is empty" copy="Choose a pack from the shop." action={<Link href="/packs" className="button primary">Visit pack shop</Link>} /></div>;

  const revealOne = async (card: import("@/lib/client-state").RewardCard) => {
    if (card.revealed || pendingId) return;
    setPendingId(card.id);
    playPackEffect("shimmer", { targetId: card.id, intensity: "low", audioHook: "card_flip" });
    const preDelay = card.rarity === "Apex" ? 380 : card.rarity === "Alpha" ? 230 : 120;
    await new Promise((resolve) => window.setTimeout(resolve, preDelay));
    reveal(opening.id, card.id);
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    const effect = RARITY_PACK_EFFECT[card.rarity];
    playPackEffect(effect, { targetId: card.id, audioHook: effect.replace("-", "_") });
    const settleDelay = card.rarity === "Apex" ? 1500 : card.rarity === "Alpha" ? 850 : card.rarity === "Prime" ? 560 : 300;
    await new Promise((resolve) => window.setTimeout(resolve, settleDelay));
    setPendingId(null);
  };

  const revealAll = async () => {
    if (revealingAll || pendingId) return;
    setRevealingAll(true);
    for (const card of opening.cards.filter((item) => !item.revealed)) await revealOne(card);
    setRevealingAll(false);
  };

  const revealed = opening.cards.filter((card) => card.revealed).length;
  const pendingRarity = opening.cards.find((card) => card.id === pendingId)?.rarity.toLowerCase();
  return <div className={`opening-page ${pendingId ? "reveal-active" : ""} ${pendingRarity ? `active-${pendingRarity}` : ""}`}><div className="pack-vfx-dimmer" /><div className="opening-head"><div><span className="eyebrow">PACK CHAMBER</span><h1>{opening.name}</h1><p>{opening.complete ? "Everything is yours." : "Choose a card. Read the shimmer. Reveal one at a time."}</p></div><div className="opening-progress"><strong>{revealed}/{opening.cards.length}</strong><button className="button ghost" disabled={opening.complete || revealingAll || !!pendingId} onClick={() => void revealAll()}>{revealingAll ? "Revealing…" : "Reveal all"} <WandSparkles /></button></div></div><div className={`reveal-grid count-${opening.cards.length}`}>{opening.cards.map((card) => <button key={card.id} data-vfx-id={card.id} aria-label={card.revealed ? "Revealed card" : "Reveal card"} disabled={!!pendingId && pendingId !== card.id} className={`reveal-card ${card.revealed ? "revealed" : ""} ${pendingId === card.id ? "revealing" : ""} tell-${card.rarity.toLowerCase()}`} onClick={() => !card.revealed && void revealOne(card)}><span className="reveal-aura" /><span className="reveal-inner"><span className="card-back"><img src="/cards/Mystics/back.png" alt="Mini Mystics card back" /></span><span className="card-front"><RewardFace card={card} /></span></span></button>)}</div>{opening.complete ? <div className="opening-complete"><div><Check /><span><strong>Pack complete</strong><small>Rewards redeemed. Cards added to your collection.</small></span></div><Link href="/loadouts" className="button primary">Build a lineup <ArrowRight /></Link></div> : null}</div>;
}

function RewardFace({ card }: { card: import("@/lib/client-state").RewardCard }) {
  if (card.definitionId) {
    const definition = definitionFor(card.definitionId);
    if (definition?.image) return <img className="full-card-image" src={definition.image} alt={`${definition.name} card`} />;
    return <CardTile definitionId={card.definitionId} />;
  }
  const rewardKind = card.kind as keyof typeof REWARD_ART;
  return <img className="full-card-image" src={REWARD_ART[rewardKind]} alt={`${card.kind === "coinBoost" ? "2× Coins" : card.kind === "xpBoost" ? "2× XP" : card.kind === "coins" ? "Coins" : "XP"} reward card`} />;
}

export function InventoryView() {
  const { state, activateBoost } = useGame();
  return <div className="page"><PageHead eyebrow="SUPPLY CASE" title="Boost inventory" copy="Boosts last for completed matches. Matching boosts extend duration; they never become 4×." /><div className="active-boost-cards"><BoostLine label="2× XP" matches={state.activeBoosts.xp?.matches} tone="violet" /><BoostLine label="2× Coins" matches={state.activeBoosts.coins?.matches} tone="gold" /></div>{state.inventory.length ? <div className="inventory-grid">{state.inventory.map((boost) => <article className={`inventory-boost ${boost.type}`} key={boost.id}><span><Zap /></span><small>{boost.rarity} BOOST</small><h2>2× {boost.type === "xp" ? "XP" : "Coins"}</h2><p>{boost.matches} completed matches</p><button className="button primary" disabled={!!state.battle && !state.battle.winner} onClick={() => activateBoost(boost.id)}>Activate</button></article>)}</div> : <Empty icon={<Backpack />} title="No boosts stored" copy="Boost cards can appear in Standard and Starter packs." action={<Link className="button primary" href="/packs">Browse packs</Link>} />}</div>;
}

export function BindersView() {
  const { state, createBinder, renameBinder, toggleBinderCard } = useGame(); const [name, setName] = useState(""); const [active, setActive] = useState(state.binders[0]?.id ?? ""); const binder = state.binders.find((item) => item.id === active);
  return <div className="page"><PageHead eyebrow="PERSONAL ARCHIVE" title="Custom collections" copy="Organize individual owned cards into binders. These are not booster packs." action={<form className="inline-form" onSubmit={(e) => { e.preventDefault(); createBinder(name); setName(""); }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New binder name" /><button className="button primary"><FolderPlus />Create</button></form>} />{state.binders.length ? <div className="binder-layout"><aside className="binder-tabs">{state.binders.map((item) => <button className={item.id === active ? "active" : ""} key={item.id} onClick={() => setActive(item.id)}><Archive />{item.name}<small>{item.cardIds.length}</small></button>)}</aside><section className="panel binder-content">{binder ? <><div className="binder-title"><input value={binder.name} onChange={(e) => renameBinder(binder.id, e.target.value)} /><span>{binder.cardIds.length} cards filed</span></div><p>Tap cards to add or remove their owned instance.</p><div className="picker-row large">{state.ownedCards.map((owned) => <CardTile key={owned.id} definitionId={owned.definitionId} compact selected={binder.cardIds.includes(owned.id)} onClick={() => toggleBinderCard(binder.id, owned.id)} />)}</div></> : null}</section></div> : <Empty icon={<Archive />} title="Create your first binder" copy="Name it, then file any owned card instances inside." />}</div>;
}

export function ProfileView() {
  const { state } = useGame(); const unique = new Set(state.ownedCards.map((card) => card.definitionId)).size; const winRate = state.matches ? Math.round(state.wins / state.matches * 100) : 0;
  return <div className="page"><PageHead eyebrow="HANDLER RECORD" title={state.account?.username ?? "Profile"} copy={state.account?.email} /><div className="profile-card"><div className="profile-avatar">{state.account?.username.slice(0, 2).toUpperCase()}</div><div><span>LEVEL {state.level}</span><h2>{state.account?.username}</h2><p>Joined the First Convergence · Unranked</p></div><div className="profile-xp"><strong>{state.xp} XP</strong><span>Next level: {xpForLevel(state.level)}</span></div></div><div className="profile-stats"><article><Trophy /><strong>{state.wins}</strong><span>Wins</span></article><article><Swords /><strong>{state.matches}</strong><span>Matches</span></article><article><Target /><strong>{winRate}%</strong><span>Win rate</span></article><article><Layers3 /><strong>{unique}/109</strong><span>Unique cards</span></article><article><Coins /><strong>{state.coins}</strong><span>Coins</span></article></div></div>;
}

function LegacyBattleView() {
  const { state, basicAttack, specialAttack, useHandler, aiTurn } = useGame(); const battle = state.battle; const [actorId, setActorId] = useState(""); const [targetId, setTargetId] = useState(""); const [handlerIndex, setHandlerIndex] = useState<number | null>(null);
  useEffect(() => { if (battle?.currentTurn !== "ai" || battle.winner) return; const timer = window.setTimeout(aiTurn, 760); return () => window.clearTimeout(timer); }, [battle?.currentTurn, battle?.turnNumber, battle?.winner, aiTurn]);
  useEffect(() => { if (battle) { const actor = battle.player.mystics.find((m) => !m.defeated); const target = battle.ai.mystics.find((m) => !m.defeated); if (!battle.player.mystics.some((m) => m.instanceId === actorId && !m.defeated)) setActorId(actor?.instanceId ?? ""); if (!battle.ai.mystics.some((m) => m.instanceId === targetId && !m.defeated)) setTargetId(target?.instanceId ?? ""); } }, [battle, actorId, targetId]);
  if (!battle) return <div className="page"><PageHead eyebrow="BATTLEFIELD" title="No active battle" /><Empty icon={<Swords />} title="Choose an opponent" copy="Enter the campaign to begin a full match." action={<Link href="/campaign" className="button primary">View campaign</Link>} /></div>;
  const actor = battle.player.mystics.find((m) => m.instanceId === actorId); const playerTurn = battle.currentTurn === "player" && !battle.winner;
  const handler = handlerIndex === null ? null : battle.player.handlers[handlerIndex]; const handlerDef = handler ? catalog.handlers.find((item) => item.id === handler.definitionId) : null;
  const targetOptions = handlerDef?.target === "ally" ? battle.player.mystics : battle.ai.mystics;
  const battleStyle = { "--battle-art": `url("${BATTLE_ART[battle.ai.name] ?? "/art/backgrounds/battle-astral.webp"}")` } as React.CSSProperties;
  return <div className="battle-page" style={battleStyle}><header className="battle-status"><div><span className={`turn-dot ${battle.currentTurn}`} />{battle.winner ? `${battle[battle.winner].name} wins` : battle.currentTurn === "player" ? "Your turn" : `${battle.ai.name} is choosing…`}</div><strong>TURN {battle.turnNumber}</strong>{battle.lastRoll ? <span className="last-roll"><Dices />{battle.lastRoll}</span> : <span>{battle.size} × {battle.size}</span>}</header>
    <div className="battlefield"><section className="team enemy-team"><div className="team-label"><span>OPPONENT</span><strong>{battle.ai.name}</strong></div><div className="combat-row">{battle.ai.mystics.map((m) => <CombatCard key={m.instanceId} mystic={m} selected={targetId === m.instanceId} onClick={() => !m.defeated && setTargetId(m.instanceId)} />)}</div></section><div className="versus-line"><i /><span>VS</span><i /></div><section className="team player-team"><div className="combat-row">{battle.player.mystics.map((m) => <CombatCard key={m.instanceId} mystic={m} selected={actorId === m.instanceId} onClick={() => !m.defeated && setActorId(m.instanceId)} />)}</div><div className="team-label"><span>YOUR LINEUP</span><strong>{battle.player.name}</strong></div></section></div>
    <section className="battle-console"><div className="action-panel"><div className="selection-summary"><span><Target />ACTOR</span><strong>{actor?.name ?? "Choose a Mystic"}</strong><small>Targeting {battle.ai.mystics.find((m) => m.instanceId === targetId)?.name ?? "—"}</small></div><button className="action-button basic" disabled={!playerTurn || !actorId || !targetId} onClick={() => basicAttack(actorId, targetId)}><Swords /><span><strong>Basic Attack</strong><small>Always hits · no cooldown</small></span><b>{actor ? Math.max(1, actor.baseAttack - (battle.ai.mystics.find((m) => m.instanceId === targetId)?.defense ?? 0)) : "—"}</b></button>{actor?.moves.map((move, index) => { const cooldown = actor.cooldowns[move.name] ?? 0; return <button className="action-button special" key={move.name} title={move.needsReview ? move.reviewReason : undefined} disabled={!playerTurn || cooldown > 0 || move.needsReview || actor.effects.some((effect) => effect.kind === "specialLock")} onClick={() => specialAttack(actorId, targetId, index)}><Sparkles /><span><strong>{move.name}</strong><small>{move.needsReview ? "Needs rules review" : `${move.rawText.split("=")[1]} · roll ${move.minimumRoll ? `${move.minimumRoll}+` : move.exactRoll}`}</small></span>{cooldown ? <b><TimerReset />{cooldown}</b> : <b>CD {move.cooldown}</b>}</button>; })}<div className="handler-actions"><span>HANDLERS</span>{battle.player.handlers.map((item, index) => <button className={handlerIndex === index ? "active" : ""} disabled={!playerTurn || item.uses >= item.maxUses} key={item.definitionId} onClick={() => setHandlerIndex(handlerIndex === index ? null : index)}><WandSparkles /><span>{item.name}<small>{item.maxUses - item.uses} use{item.maxUses - item.uses === 1 ? "" : "s"}</small></span></button>)}</div>{handlerDef ? <div className="handler-confirm"><p>{handlerDef.effect}</p><div>{targetOptions.filter((m) => !m.defeated).map((m) => <button key={m.instanceId} onClick={() => { useHandler(handlerIndex!, m.instanceId); setHandlerIndex(null); }}>{m.name}</button>)}</div></div> : null}</div>
      <aside className="battle-log"><div className="panel-title"><span><ScrollText />BATTLE LOG</span><small>{battle.events.length} events</small></div><div className="log-list">{[...battle.events].reverse().map((item) => <div className={item.type} key={item.id}><span>T{item.turn}</span><p>{item.message}</p></div>)}</div>{battle.winner && state.lastRewards ? <div className="reward-summary"><span>{state.lastRewards.won ? <Trophy /> : <Shield />}</span><div><strong>{state.lastRewards.won ? "Victory rewards" : "Battle rewards"}</strong><p>+{state.lastRewards.xp} XP · +{state.lastRewards.coins} Coins</p></div><Link href="/game"><ArrowRight /></Link></div> : null}</aside>
    </section>
  </div>;
}

function CombatCard({ mystic, selected, onClick }: { mystic: import("@/lib/game/types").Combatant; selected: boolean; onClick: () => void }) {
  const power = Math.round(mystic.currentPower / mystic.maxPower * 100);
  return <button className={`combat-card ${selected ? "selected" : ""} ${mystic.defeated ? "defeated" : ""} ${power <= 25 ? "power-low" : power <= 55 ? "power-medium" : "power-high"}`} onClick={onClick}><span className="combat-art">{mystic.image ? <img src={mystic.image} alt="" /> : null}<span className="combat-order">{mystic.order}</span></span><span className="combat-copy"><strong>{mystic.name}</strong><span className="power-bar"><i style={{ width: `${power}%` }} /></span><span className="combat-stats"><b><Heart />{mystic.currentPower}</b><b><Shield />{mystic.defense + mystic.effects.filter((e) => e.kind === "defense").reduce((a, e) => a + e.value, 0)}</b><b><Swords />{mystic.baseAttack}</b></span>{mystic.effects.length ? <span className="effect-count">{mystic.effects.length} effect{mystic.effects.length > 1 ? "s" : ""}</span> : null}</span>{mystic.defeated ? <em>DEFEATED</em> : null}</button>;
}

export function SettingsView() {
  return <div className="page"><PageHead eyebrow="SYSTEM" title="Settings" copy="Presentation and accessibility preferences for this device." />
    <div className="settings-grid">
      <section className="panel settings-panel"><div className="settings-icon"><MonitorCog /></div><div><h2>Display</h2><p>The Mini Mystics interface follows your device motion preference and scales responsively from desktop to mobile.</p></div></section>
      <section className="panel settings-panel"><div className="settings-icon"><Sparkles /></div><div><h2>Visual identity</h2><p>Official card, Order, pack, reward, opponent, and environment artwork is loaded directly from the project asset library.</p></div><span className="status-chip success"><Check /> Asset library active</span></section>
      <section className="panel settings-panel"><div className="settings-icon"><Shield /></div><div><h2>Account security</h2><p>This prototype stores its demo account and game progress locally in this browser.</p></div><span className="status-chip warning">Prototype mode</span></section>
    </div>
  </div>;
}

export function ComingSoonView({ kind }: { kind: "Marketplace" | "Trading" }) { return <div className="page coming-page" style={{ backgroundImage: `linear-gradient(rgba(7,16,24,.78), rgba(7,16,24,.94)), url("${COMING_SOON_ART[kind]}")` }}><div className="coming-glyph">{kind === "Marketplace" ? <Coins /> : <UsersRound />}</div><span className="eyebrow">FUTURE CONVERGENCE</span><h1>{kind} — Coming Soon</h1><p>{kind === "Marketplace" ? "Player-set listings, completed sales, and price history will arrive in a later release. No rarity-based price floors or ceilings." : "Direct card-for-card offers with two-party confirmation and atomic settlement are planned for a later release."}</p><Link href="/game" className="button primary">Return to command</Link></div>; }

export { RefinedBattleView as BattleView };
