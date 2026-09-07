"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, Backpack, Boxes, Check, ChevronRight, Coins, Crown, Filter, ImageOff, Layers3, LockKeyhole, MonitorCog, PackageOpen, ScrollText, Shield, Sparkles, Star, Swords, Target, Trophy, UsersRound, WandSparkles, Zap } from "lucide-react";
import { useGame } from "./game-provider";
import { CardTile } from "./card-tile";
import { CardInspectModal } from "./card-inspect-modal";
import { LoadoutManagerModal } from "./loadout-manager-modal";
import { BinderManagerModal } from "./binder-manager-modal";
import { BattleView as RefinedBattleView } from "./battle/battle-view";
import { VFXManager, useVFX } from "./vfx/vfx-manager";
import { ALL_CAMPAIGN_STAGES, ORDER_CAMPAIGNS, catalog, definitionFor } from "@/lib/client-state";
import { xpForLevel } from "@/lib/game/rewards";
import { PACK_DEFINITIONS } from "@/lib/game/packs";
import { isStageUnlocked } from "@/lib/game/campaigns";
import { BATTLE_ART, COMING_SOON_ART, ORDER_ART, ORDER_COLORS, PACK_ART, REWARD_ART } from "@/lib/art";
import { RARITY_PACK_EFFECT } from "@/lib/vfx/presets";

const PageHead = ({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: React.ReactNode }) => <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{copy ? <p>{copy}</p> : null}</div>{action}</div>;
const Empty = ({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action?: React.ReactNode }) => <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p>{action}</div>;

export function DashboardView() {
  const { state, startBattle } = useGame();
  const unfinished = state.openings.find((opening) => !opening.complete);
  const mysticCount = state.ownedCards.filter((owned) => catalog.mystics.some((card) => card.id === owned.definitionId)).length;
  const progress = Math.min(100, Math.round(state.xp / xpForLevel(state.level) * 100));
  const campaignWins = state.campaignWins ?? [];
  const nextStageEntry = ALL_CAMPAIGN_STAGES.filter((stage) => !campaignWins.includes(stage.id)).map((stage) => ({ stage, campaign: ORDER_CAMPAIGNS.find((c) => c.stages.includes(stage))! })).find(({ stage }) => isStageUnlocked(stage, state.level, campaignWins)) ?? { stage: ALL_CAMPAIGN_STAGES[0], campaign: ORDER_CAMPAIGNS[0] };
  return <div className="page dashboard-page">
    <section className="command-hero">
      <div className="hero-copy"><span className="eyebrow">HANDLER COMMAND</span><h1>Your next battle<br />starts with a <em>choice.</em></h1><p>Pick any surviving Mystic. Read the field. Commit one action.</p><div className="hero-actions">{mysticCount >= nextStageEntry.stage.size ? <button className="button primary" onClick={() => startBattle(nextStageEntry.stage.id)}>Quick battle <Swords /></button> : <Link className="button primary" href="/open">Open starter pack <PackageOpen /></Link>}<Link className="button ghost" href="/collection">Edit lineup <ChevronRight /></Link></div></div>
      <div className="featured-stack" aria-label="Featured collection cards">{state.ownedCards.slice(0, 3).map((owned, index) => <div className={`stack-card stack-${index}`} key={owned.id}><CardTile definitionId={owned.definitionId} /></div>)}</div>
      <div className="hero-rune" aria-hidden="true">✦</div>
    </section>
    {unfinished ? <Link className="starter-alert" href="/open"><span><PackageOpen /></span><div><small>PACK WAITING</small><strong>Finish revealing your {unfinished.name}</strong></div><ArrowRight /></Link> : null}
    <section className="dashboard-grid">
      <div className="panel progress-panel"><div className="panel-title"><span><Crown />HANDLER PROGRESS</span><b>LV {state.level}</b></div><div className="level-line"><strong>{state.xp}<small> XP</small></strong><span>{xpForLevel(state.level)} to next level</span></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="mini-stats"><span><b>{state.wins}</b> wins</span><span><b>{state.matches}</b> matches</span><span><b>{state.ownedCards.length}</b> cards</span></div></div>
      <div className="panel boost-panel"><div className="panel-title"><span><Zap />ACTIVE BOOSTS</span><Link href="/inventory">Manage</Link></div><BoostLine label="2× XP" matches={state.activeBoosts.xp?.matches} tone="violet" /><BoostLine label="2× Coins" matches={state.activeBoosts.coins?.matches} tone="gold" /></div>
      <div className="panel next-panel"><div className="panel-title"><span><Target />NEXT ENCOUNTER</span><small>{nextStageEntry.stage.difficulty.toUpperCase()}</small></div><h3>{nextStageEntry.stage.opponentName}</h3><p>A {nextStageEntry.campaign.order} lineup. Bring exactly {nextStageEntry.stage.size} Mystics.</p><button className="text-button" onClick={() => startBattle(nextStageEntry.stage.id)}>Enter encounter <ArrowRight /></button></div>
    </section>
    <section className="quick-grid"><Link href="/collection"><Layers3 /><span><strong>Collection</strong><small>{state.ownedCards.length} owned cards</small></span><ChevronRight /></Link><Link href="/packs"><PackageOpen /><span><strong>Pack shop</strong><small>Improve your lineup</small></span><ChevronRight /></Link><Link href="/campaign"><Trophy /><span><strong>Campaign</strong><small>{state.campaignWins.length} encounters cleared</small></span><ChevronRight /></Link></section>
  </div>;
}

function BoostLine({ label, matches, tone }: { label: string; matches?: number; tone: string }) { return <div className={`boost-line ${tone}`}><span><Zap /></span><div><strong>{matches ? label : `${label} inactive`}</strong><small>{matches ? `${matches} matches remaining` : "Activate a boost from inventory"}</small></div></div>; }

export function CollectionView() {
  const { state } = useGame();
  const editLoadoutParam = useSearchParams().get("editLoadout");
  const [kind, setKind] = useState("all"); const [rarity, setRarity] = useState("all"); const [order, setOrder] = useState("all"); const [allegiance, setAllegiance] = useState("all"); const [binderFilter, setBinderFilter] = useState("all"); const [sort, setSort] = useState("name"); const [query, setQuery] = useState(""); const [inspectId, setInspectId] = useState<string | null>(null);
  const [showLoadouts, setShowLoadouts] = useState(Boolean(editLoadoutParam));
  const [showBinders, setShowBinders] = useState(false);
  const grouped = useMemo(() => state.ownedCards.reduce<Record<string, typeof state.ownedCards>>((acc, owned) => ((acc[owned.definitionId] ??= []).push(owned), acc), {}), [state.ownedCards]);
  const activeBinder = state.binders.find((item) => item.id === binderFilter);
  const cards = Object.entries(grouped).filter(([id, copies]) => { const card = definitionFor(id)!; const isMystic = "power" in card; return (kind === "all" || (kind === "mystic") === isMystic) && (rarity === "all" || card.rarity === rarity) && (order === "all" || card.order === order) && (allegiance === "all" || card.allegiance === allegiance) && (binderFilter === "all" || copies.some((owned) => activeBinder?.cardIds.includes(owned.id))) && card.name.toLowerCase().includes(query.toLowerCase()); }).sort(([a], [b]) => { const first = definitionFor(a)!; const second = definitionFor(b)!; if (sort === "order") return first.order.localeCompare(second.order) || first.name.localeCompare(second.name); if (sort === "rarity") return ["Apex", "Alpha", "Prime", "Predator", "Hunter", "Wild", "Unassigned"].indexOf(first.rarity) - ["Apex", "Alpha", "Prime", "Predator", "Hunter", "Wild", "Unassigned"].indexOf(second.rarity); return first.name.localeCompare(second.name); });
  const activeLoadouts = state.loadouts.filter((loadout) => loadout.active);
  return <div className="page"><PageHead eyebrow="THE ARCHIVE" title="Your collection" copy={`${state.ownedCards.length} individual card instances · ${Object.keys(grouped).length} unique definitions`} action={<div className="collection-head-actions"><button className="button ghost" onClick={() => setShowBinders(true)}><Archive />Binders</button><button className="button primary" onClick={() => setShowLoadouts(true)}><Boxes />Loadouts</button></div>} />
    {activeLoadouts.length ? <div className="active-loadout-strip">{activeLoadouts.map((loadout) => <span key={loadout.id}><Star />{loadout.size}-Mystic active: <b>{loadout.name}</b></span>)}</div> : null}
    <div className="filterbar collection-filters"><label className="search"><Filter /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a card" /></label><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All card types</option><option value="mystic">Mystics</option><option value="handler">Handlers</option></select><select value={rarity} onChange={(e) => setRarity(e.target.value)}><option value="all">All rarities</option>{["Wild", "Hunter", "Predator", "Prime", "Alpha", "Apex", "Unassigned"].map((r) => <option key={r}>{r}</option>)}</select><select value={order} onChange={(e) => setOrder(e.target.value)}><option value="all">All Orders</option>{[...new Set(catalog.mystics.map((m) => m.order))].map((o) => <option key={o}>{o}</option>)}</select><select value={allegiance} onChange={(e) => setAllegiance(e.target.value)}><option value="all">All allegiances</option>{[...new Set([...catalog.mystics, ...catalog.handlers].map((card) => card.allegiance))].sort().map((item) => <option key={item}>{item}</option>)}</select>{state.binders.length ? <select value={binderFilter} onChange={(e) => setBinderFilter(e.target.value)}><option value="all">All binders</option>{state.binders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Sort: Name</option><option value="rarity">Sort: Rarity</option><option value="order">Sort: Order</option></select></div>
    {cards.length ? <div className="collection-grid">{cards.map(([definitionId, copies]) => <CardTile key={definitionId} definitionId={definitionId} level={Math.max(...copies.map((owned) => owned.level))} onClick={() => setInspectId(definitionId)} footer={<b>×{copies.length}</b>} />)}</div> : <Empty icon={<Layers3 />} title="No cards match" copy="Try a different filter or open a new pack." />}
    {inspectId ? <CardInspectModal definitionId={inspectId} ownedCards={grouped[inspectId] ?? []} onClose={() => setInspectId(null)} /> : null}
    {showLoadouts ? <LoadoutManagerModal editLoadoutId={editLoadoutParam} onClose={() => setShowLoadouts(false)} /> : null}
    {showBinders ? <BinderManagerModal onClose={() => setShowBinders(false)} /> : null}
  </div>;
}

export function CampaignView() {
  const { state, startBattle } = useGame();
  const campaignWins = state.campaignWins ?? [];
  const totalStages = ALL_CAMPAIGN_STAGES.length;
  const clearedCount = ALL_CAMPAIGN_STAGES.filter((stage) => campaignWins.includes(stage.id)).length;
  const overallComplete = clearedCount === totalStages;
  const [selectedOrder, setSelectedOrder] = useState(() => (ORDER_CAMPAIGNS.find((c) => c.stages.some((s) => !campaignWins.includes(s.id))) ?? ORDER_CAMPAIGNS[0]).order);
  const campaign = ORDER_CAMPAIGNS.find((c) => c.order === selectedOrder) ?? ORDER_CAMPAIGNS[0];
  const campaignCleared = campaign.stages.filter((s) => campaignWins.includes(s.id)).length;
  const campaignComplete = campaignCleared === campaign.stages.length;
  const progress = Math.round(campaignCleared / campaign.stages.length * 100);
  const nextStage = campaign.stages.find((s) => !campaignWins.includes(s.id));
  const ownedMysticCount = state.ownedCards.filter((owned) => catalog.mystics.some((m) => m.id === owned.definitionId)).length;
  return <div className="page campaign-page">
    <PageHead eyebrow="THE FIRST CONVERGENCE" title="Campaign path" copy={`Ten Order campaigns, each built from its own Mystics. ${clearedCount} of ${totalStages} stages cleared overall.`} />
    <nav className="campaign-order-tabs" aria-label="Choose a campaign">
      {ORDER_CAMPAIGNS.map((c) => { const cleared = c.stages.filter((s) => campaignWins.includes(s.id)).length; const complete = cleared === c.stages.length; return <button type="button" key={c.order} className={`${c.order === selectedOrder ? "active" : ""} ${complete ? "complete" : ""}`} style={{ "--order-color": ORDER_COLORS[c.order] ?? "#D7A93B" } as React.CSSProperties} onClick={() => setSelectedOrder(c.order)}>{ORDER_ART[c.order] ? <img src={ORDER_ART[c.order]} alt="" /> : null}<span>{c.order}</span><small>{complete ? <Check /> : `${cleared}/${c.stages.length}`}</small></button>; })}
    </nav>
    <section className={`campaign-progress-card ${campaignComplete ? "complete" : ""}`} aria-label={`${campaign.name} progress: ${campaignCleared} of ${campaign.stages.length} stages cleared`}>
      <span className="campaign-progress-emblem">{campaignComplete ? <Trophy /> : <ScrollText />}</span>
      <div className="campaign-progress-copy"><small>{campaignComplete ? "CAMPAIGN MASTERED" : "CAMPAIGN PROGRESS"}</small><strong>{campaign.name}</strong><p>{campaignComplete ? "Every stage has fallen. You can replay any stage." : nextStage ? `Next: ${nextStage.opponentName}` : "Continue the campaign."}</p></div>
      <b>{progress}%</b>
      <div className="campaign-progress-rail" style={{ "--campaign-progress": `${progress}%` } as React.CSSProperties}>
        <i aria-hidden="true" />
        <ol>{campaign.stages.map((stage, index) => { const cleared = campaignWins.includes(stage.id); const current = !campaignComplete && stage.id === nextStage?.id; return <li key={stage.id} className={`${cleared ? "cleared" : ""} ${current ? "current" : ""}`} title={`Stage ${stage.stageNumber}: ${cleared ? "cleared" : "not cleared"}`}><span>{cleared ? <Check /> : index + 1}</span><small>Stage {stage.stageNumber}</small></li>; })}</ol>
      </div>
    </section>
    <div className="campaign-path">{campaign.stages.map((stage, index) => {
      const unlocked = isStageUnlocked(stage, state.level, campaignWins);
      const cleared = campaignWins.includes(stage.id);
      const compatible = ownedMysticCount >= stage.size;
      return <article className={`encounter ${!unlocked ? "locked" : ""} ${cleared ? "cleared" : ""}`} key={stage.id}>
        <span className="path-index">{cleared ? <Check /> : index + 1}</span>
        <div className="encounter-art">{ORDER_ART[campaign.order] ? <img src={ORDER_ART[campaign.order]} alt="" /> : null}</div>
        <div className="encounter-copy">
          <div className="encounter-status"><span className={`difficulty ${stage.difficulty.toLowerCase()}`}>{stage.difficulty}</span>{cleared ? <span className="cleared-label"><Check />Cleared</span> : null}</div>
          <h2>{stage.opponentName}</h2>
          <p>{stage.aiLogicProfile} playstyle · {stage.size}-Mystic battle · Level {stage.opponentLevel}</p>
          <small className={cleared ? "reward-claimed" : ""}><Coins />{cleared ? `First clear bonus claimed: ${stage.firstClearReward.coins} Coins + ${stage.firstClearReward.essence} ${campaign.order} Essence` : `First clear bonus: ${stage.firstClearReward.coins} Coins + ${stage.firstClearReward.essence} ${campaign.order} Essence`}</small>
        </div>
        {!unlocked ? <div className="lock-copy"><LockKeyhole />{state.level < stage.unlockRequirement.minPlayerLevel ? `Unlocks at level ${stage.unlockRequirement.minPlayerLevel}` : "Clear the previous stage first"}</div> : <button disabled={!compatible} className={`button ${cleared ? "ghost" : "primary"}`} onClick={() => startBattle(stage.id)}>{compatible ? cleared ? "Replay" : "Challenge" : `Need ${stage.size} Mystics`}<Swords /></button>}
      </article>;
    })}</div>
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
  return <div className={`opening-page ${pendingId ? "reveal-active" : ""} ${pendingRarity ? `active-${pendingRarity}` : ""}`}><div className="pack-vfx-dimmer" /><div className="opening-head"><div><span className="eyebrow">PACK CHAMBER</span><h1>{opening.name}</h1><p>{opening.complete ? "Everything is yours." : "Choose a card. Read the shimmer. Reveal one at a time."}</p></div><div className="opening-progress"><strong>{revealed}/{opening.cards.length}</strong><button className="button ghost" disabled={opening.complete || revealingAll || !!pendingId} onClick={() => void revealAll()}>{revealingAll ? "Revealing…" : "Reveal all"} <WandSparkles /></button></div></div><div className={`reveal-grid count-${opening.cards.length}`}>{opening.cards.map((card) => <button key={card.id} data-vfx-id={card.id} aria-label={card.revealed ? "Revealed card" : "Reveal card"} disabled={!!pendingId && pendingId !== card.id} className={`reveal-card ${card.revealed ? "revealed" : ""} ${pendingId === card.id ? "revealing" : ""} tell-${card.rarity.toLowerCase()}`} onClick={() => !card.revealed && void revealOne(card)}><span className="reveal-aura" /><span className="reveal-inner"><span className="card-back"><img src="/cards/Mystics/back.png" alt="Mini Mystics card back" /></span><span className="card-front"><RewardFace card={card} /></span></span></button>)}</div>{opening.complete ? <div className="opening-complete"><div><Check /><span><strong>Pack complete</strong><small>Rewards redeemed. Cards added to your collection.</small></span></div><Link href="/collection" className="button primary">Build a lineup <ArrowRight /></Link></div> : null}</div>;
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

export function ProfileView() {
  const { state } = useGame(); const unique = new Set(state.ownedCards.map((card) => card.definitionId)).size; const winRate = state.matches ? Math.round(state.wins / state.matches * 100) : 0;
  return <div className="page"><PageHead eyebrow="HANDLER RECORD" title={state.account?.username ?? "Profile"} copy={state.account?.email} /><div className="profile-card"><div className="profile-avatar">{state.account?.username.slice(0, 2).toUpperCase()}</div><div><span>LEVEL {state.level}</span><h2>{state.account?.username}</h2><p>Joined the First Convergence · Unranked</p></div><div className="profile-xp"><strong>{state.xp} XP</strong><span>Next level: {xpForLevel(state.level)}</span></div></div><div className="profile-stats"><article><Trophy /><strong>{state.wins}</strong><span>Wins</span></article><article><Swords /><strong>{state.matches}</strong><span>Matches</span></article><article><Target /><strong>{winRate}%</strong><span>Win rate</span></article><article><Layers3 /><strong>{unique}/109</strong><span>Unique cards</span></article><article><Coins /><strong>{state.coins}</strong><span>Coins</span></article></div></div>;
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
