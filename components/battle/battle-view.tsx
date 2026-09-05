"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Check, CircleOff, Clock3, Dices, Eye, GripHorizontal, Heart, Info, Maximize2, Minus, RotateCcw, ScrollText, Shield, Sparkles, Swords, Target, Trophy, WandSparkles, X, Zap } from "lucide-react";
import { useGame } from "../game-provider";
import { VFXManager, useVFX } from "../vfx/vfx-manager";
import { BATTLE_ART, OPPONENT_ART, ORDER_ART, ORDER_COLORS } from "@/lib/art";
import { catalog } from "@/lib/client-state";
import type { BattleEvent, BattleSide, Combatant, HandlerDefinition, ParsedMove, StatusEffect } from "@/lib/game/types";
import { ORDER_BATTLE_EFFECT } from "@/lib/vfx/presets";
import { BattleSetup } from "./battle-setup";

type BattleUiPhase = "INTRO" | "PLAYER_SELECT_ACTOR" | "PLAYER_SELECT_ACTION" | "PLAYER_SELECT_TARGET" | "PLAYER_ROLLING" | "PLAYER_RESOLVING" | "ENEMY_THINKING" | "ENEMY_ACTION" | "TURN_TRANSITION" | "VICTORY" | "DEFEAT";
type ActionSelection = { kind: "basic" } | { kind: "special"; moveIndex: number } | { kind: "handler"; handlerIndex: number };
type DamageFx = Record<string, { amount: number; key: number }>;

const statusLabels: Record<StatusEffect["kind"], string> = {
  attack: "Attack modified",
  defense: "Defense modified",
  marked: "Marked for bonus damage",
  evade: "Evades the next attack",
  specialLock: "Special moves disabled",
  counter: "Counter readied",
  reroll: "One failed special may be rerolled",
};

const stateCopy: Record<BattleUiPhase, string> = {
  INTRO: "The starting roll decides who acts first.",
  PLAYER_SELECT_ACTOR: "Choose a surviving Mystic.",
  PLAYER_SELECT_ACTION: "Choose an action or Handler.",
  PLAYER_SELECT_TARGET: "Choose a highlighted target.",
  PLAYER_ROLLING: "Roll the die to resolve this action.",
  PLAYER_RESOLVING: "Resolving your action…",
  ENEMY_THINKING: "Your opponent is choosing an action…",
  ENEMY_ACTION: "Opponent action resolving…",
  TURN_TRANSITION: "The turn is changing…",
  VICTORY: "Battle complete.",
  DEFEAT: "Battle complete.",
};

function effectiveDefense(mystic: Combatant) {
  return Math.max(0, mystic.defense + mystic.effects.filter((effect) => effect.kind === "defense").reduce((sum, effect) => sum + effect.value, 0));
}

function actionDamage(actor: Combatant | undefined, target: Combatant | undefined, move?: ParsedMove) {
  if (!actor || !target) return null;
  const attackBuff = actor.effects.filter((effect) => effect.kind === "attack").reduce((sum, effect) => sum + effect.value, 0);
  const attack = (actor.baseAttack * (move?.attackMultiplier ?? 1)) + (move?.attackModifier ?? 0) + attackBuff;
  const defense = move?.ignoreDefense ? 0 : effectiveDefense(target);
  return Math.max(1, attack - defense) * (move?.multiHitCount ?? 1) + (target.effects.find((effect) => effect.kind === "marked")?.value ?? 0);
}

function startingRolls(message?: string) {
  const rolls = message?.match(/rolled (\d).* rolled (\d)/i);
  return { player: Number(rolls?.[1] ?? 0), opponent: Number(rolls?.[2] ?? 0) };
}

export function BattleView() {
  const opponentId = useSearchParams().get("opponent");
  if (opponentId) return <BattleSetup opponentId={opponentId} />;
  return <VFXManager scope="battle"><BattleExperience /></VFXManager>;
}

function BattleExperience() {
  const { state, basicAttack, specialAttack, useHandler, aiTurn } = useGame();
  const { playBattleEffect, emitAudioHook } = useVFX();
  const battle = state.battle;
  const [phase, setPhase] = useState<BattleUiPhase>("INTRO");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [selection, setSelection] = useState<ActionSelection | null>(null);
  const [inspect, setInspect] = useState<Combatant | null>(null);
  const [rolling, setRolling] = useState(false);
  const [holdingRoll, setHoldingRoll] = useState(false);
  const [dieFace, setDieFace] = useState(1);
  const [damageFx, setDamageFx] = useState<DamageFx>({});
  const [aiBanner, setAiBanner] = useState(false);
  const [showEnd, setShowEnd] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [rollOutcome, setRollOutcome] = useState<{ roll: number; success: boolean } | null>(null);
  const previousPower = useRef<Record<string, number>>({});

  const actor = battle?.player.mystics.find((mystic) => mystic.instanceId === actorId);
  const target = battle?.ai.mystics.find((mystic) => mystic.instanceId === targetId) ?? battle?.player.mystics.find((mystic) => mystic.instanceId === targetId);
  const selectedMove = selection?.kind === "special" ? actor?.moves[selection.moveIndex] : undefined;
  const selectedHandler = selection?.kind === "handler" && battle ? catalog.handlers.find((handler) => handler.id === battle.player.handlers[selection.handlerIndex]?.definitionId) : undefined;
  const isTargeting = phase === "PLAYER_SELECT_TARGET";
  const targetSide = selectedHandler?.target === "ally" ? "player" : "ai";

  useEffect(() => {
    if (!battle) return;
    const firstActor = battle.player.mystics.find((mystic) => !mystic.defeated);
    setActorId(firstActor?.instanceId ?? "");
    setTargetId("");
    setSelection(null);
    setInspect(null);
    setShowEnd(true);
    setFeedback("");
    setRollOutcome(null);
    setPhase("INTRO");
    previousPower.current = Object.fromEntries([...battle.player.mystics, ...battle.ai.mystics].map((mystic) => [mystic.instanceId, mystic.currentPower]));
    const timer = window.setTimeout(() => setPhase(battle.currentTurn === "player" ? "PLAYER_SELECT_ACTION" : "ENEMY_THINKING"), 1850);
    return () => window.clearTimeout(timer);
  }, [battle?.id]);

  useEffect(() => {
    if (!battle) return;
    const next: DamageFx = {};
    const recentAction = [...battle.events].reverse().find((event) => event.type === "special" || event.type === "attack");
    const source = [...battle.player.mystics, ...battle.ai.mystics].find((mystic) => recentAction?.message.startsWith(mystic.name));
    for (const mystic of [...battle.player.mystics, ...battle.ai.mystics]) {
      const before = previousPower.current[mystic.instanceId];
      if (before !== undefined && mystic.currentPower < before) {
        next[mystic.instanceId] = { amount: before - mystic.currentPower, key: Date.now() };
        const effect = recentAction?.type === "special" && source ? ORDER_BATTLE_EFFECT[source.order] ?? "impact" : "impact";
        playBattleEffect(effect, { targetId: mystic.instanceId, accentColor: source ? ORDER_COLORS[source.order] : undefined, audioHook: recentAction?.type === "special" ? "special" : "damage" });
        if (mystic.defeated) window.setTimeout(() => playBattleEffect("ko", { targetId: mystic.instanceId, intensity: "high", audioHook: "ko" }), 170);
      }
      if (before !== undefined && mystic.currentPower > before) playBattleEffect("heal", { targetId: mystic.instanceId, audioHook: "heal" });
      previousPower.current[mystic.instanceId] = mystic.currentPower;
    }
    if (Object.keys(next).length) {
      setDamageFx(next);
      const timer = window.setTimeout(() => setDamageFx({}), 720);
      return () => window.clearTimeout(timer);
    }
  }, [battle?.events.length, playBattleEffect]);

  useEffect(() => {
    if (!battle || battle.winner) return;
    if (battle.currentTurn === "ai" && (phase === "PLAYER_RESOLVING" || phase === "TURN_TRANSITION")) {
      const timer = window.setTimeout(() => setPhase("ENEMY_THINKING"), 220);
      return () => window.clearTimeout(timer);
    }
    if (battle.currentTurn === "player" && phase === "ENEMY_ACTION") {
      const timer = window.setTimeout(() => { setAiBanner(false); setTargetId(""); setSelection(null); setPhase("PLAYER_SELECT_ACTION"); }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [battle?.currentTurn, battle?.turnNumber, battle?.winner, phase]);

  useEffect(() => {
    if (!battle || phase !== "ENEMY_THINKING" || battle.currentTurn !== "ai" || battle.winner) return;
    setAiBanner(true);
    const timer = window.setTimeout(() => { setPhase("ENEMY_ACTION"); aiTurn(); }, 720);
    return () => window.clearTimeout(timer);
  }, [battle, phase, aiTurn]);

  useEffect(() => {
    if (!battle?.winner) return;
    setSelection(null);
    setPhase(battle.winner === "player" ? "VICTORY" : "DEFEAT");
    playBattleEffect(battle.winner === "player" ? "celestial-impact" : "void-impact", { intensity: "high", audioHook: battle.winner === "player" ? "victory" : "defeat" });
  }, [battle?.winner, playBattleEffect]);

  useEffect(() => {
    if (!battle?.lastRoll || phase === "INTRO") return;
    const recent = battle.events.slice(-5);
    const specialResult = [...recent].reverse().find((event) => event.type === "special" && typeof event.data?.success === "boolean");
    const handlerResult = [...recent].reverse().find((event) => event.type === "handler");
    const success = specialResult ? Boolean(specialResult.data?.success) : handlerResult ? !handlerResult.message.toLowerCase().includes("failed") : true;
    setRollOutcome({ roll: battle.lastRoll, success });
    const timer = window.setTimeout(() => setRollOutcome(null), 920);
    return () => window.clearTimeout(timer);
  }, [battle?.lastRoll, battle?.events.length]);

  const cancelSelection = useCallback(() => {
    setSelection(null);
    setTargetId("");
    setRolling(false);
    setFeedback("");
    setPhase("PLAYER_SELECT_ACTION");
  }, []);

  const resolveTarget = useCallback((mystic: Combatant, side: "player" | "ai") => {
    if (!battle || !selection || !actor || mystic.defeated) return;
    if (side !== targetSide) {
      setFeedback(targetSide === "player" ? "Choose a surviving allied Mystic." : "Choose a surviving enemy Mystic.");
      return;
    }
    emitAudioHook("target_select");
    setFeedback("");
    setTargetId(mystic.instanceId);
    if (selection.kind === "basic") {
      setPhase("PLAYER_RESOLVING");
      window.setTimeout(() => basicAttack(actor.instanceId, mystic.instanceId), 170);
    } else setPhase("PLAYER_ROLLING");
  }, [battle, selection, actor, targetSide, basicAttack, emitAudioHook]);

  const selectMystic = useCallback((mystic: Combatant, side: "player" | "ai") => {
    if (isTargeting) { resolveTarget(mystic, side); return; }
    if (side === "player" && battle?.currentTurn === "player" && !battle.winner) {
      if (actorId === mystic.instanceId) { setInspect(mystic); return; }
      if (!mystic.defeated) { emitAudioHook("card_select"); setActorId(mystic.instanceId); setSelection(null); setTargetId(""); setPhase("PLAYER_SELECT_ACTION"); }
    } else setInspect(mystic);
  }, [isTargeting, resolveTarget, battle, actorId, emitAudioHook]);

  const rollAction = useCallback(() => {
    if (!battle || !selection || !target || !actor || rolling) return;
    emitAudioHook("dice_roll");
    setRolling(true);
    setHoldingRoll(false);
    const resolvedFace = Math.floor(Math.random() * 6) + 1;
    let face = 1;
    const cycle = window.setInterval(() => { face = face % 6 + 1; setDieFace(face); }, 80);
    window.setTimeout(() => {
      window.clearInterval(cycle);
      setDieFace(resolvedFace);
      setHoldingRoll(true);
      window.setTimeout(() => {
        if (selection.kind === "special") specialAttack(actor.instanceId, target.instanceId, selection.moveIndex, resolvedFace);
        if (selection.kind === "handler") {
          useHandler(selection.handlerIndex, target.instanceId, resolvedFace);
          playBattleEffect(selectedHandler?.target === "ally" ? "buff" : "debuff", { targetId: target.instanceId, intensity: "medium", audioHook: "handler" });
        }
        setHoldingRoll(false);
        setRolling(false);
        setPhase("PLAYER_RESOLVING");
      }, 1000);
    }, 620);
  }, [battle, selection, target, actor, rolling, specialAttack, useHandler, playBattleEffect, selectedHandler, emitAudioHook]);

  if (!battle) return <div className="page battle-empty"><div><Swords /><span>BATTLEFIELD</span><h1>No active battle</h1><p>Choose a campaign opponent to enter the arena.</p><Link href="/campaign" className="button primary">View campaign <ArrowRight /></Link></div></div>;

  const encounterArt = BATTLE_ART[battle.ai.name];
  const battleStyle = { "--battle-art": encounterArt ? `url("${encounterArt}")` : "none" } as React.CSSProperties;
  const rolls = startingRolls(battle.events[0]?.message);
  const playerCanAct = battle.currentTurn === "player" && !battle.winner && ["PLAYER_SELECT_ACTOR", "PLAYER_SELECT_ACTION", "PLAYER_SELECT_TARGET"].includes(phase);

  return <div className={`mm-battle phase-${phase.toLowerCase()} format-${battle.size}`} style={battleStyle} data-audio-hooks="card-select target-select dice-roll special damage ko victory">
    <div className="arena-vignette" />
    <div className="battle-layout">
      <div className="battle-board-column">
        <BattleTurnBar battle={battle} phase={phase} />
        <main className="battle-arena">
          <BattleMysticRow side="ai" team={battle.ai} format={battle.size} opponentId={battle.ai.name} selectedId={targetId} targeting={isTargeting && targetSide === "ai"} damageFx={damageFx} onSelect={(mystic) => selectMystic(mystic, "ai")} />
          <div className="battle-center"><i /><span>VS</span><i /></div>
          <BattleMysticRow side="player" team={battle.player} format={battle.size} selectedId={battle.currentTurn === "player" ? actorId : ""} targetId={targetId} targeting={isTargeting && targetSide === "player"} damageFx={damageFx} onSelect={(mystic) => selectMystic(mystic, "player")} />
        </main>
        <div className={`battle-step ${feedback ? "has-feedback" : ""}`} aria-live="polite"><span>{feedback || stateCopy[phase]}</span>{selection && playerCanAct ? <button onClick={cancelSelection}><X />Cancel selection</button> : null}</div>
      </div>
      <BattleControlDeck
        battle={battle}
        actor={actor}
        target={target}
        selection={selection}
        playerCanAct={playerCanAct}
        onAction={(next) => { setSelection(next); setTargetId(""); setFeedback(""); setPhase("PLAYER_SELECT_TARGET"); }}
        onInspect={() => actor && setInspect(actor)}
      />
    </div>
    <BattleLog events={battle.events} />
    {phase === "PLAYER_ROLLING" && (selectedMove || selectedHandler) ? <div className="battle-dice-overlay" role="dialog" aria-modal="true" aria-label="Dice roll required" onMouseDown={(event) => event.target === event.currentTarget && !rolling && cancelSelection()}><BattleDiceTray requirement={selectedMove ? (selectedMove.minimumRoll ? `${selectedMove.minimumRoll}+` : String(selectedMove.exactRoll ?? selectedMove.requiredRoll)) : selectedHandler?.exactRoll ? String(selectedHandler.activationRoll) : `${selectedHandler?.activationRoll}+`} diceCount={selectedHandler?.activationDice ?? 1} rolling={rolling} holding={holdingRoll} face={dieFace} onRoll={rollAction} onCancel={cancelSelection} /></div> : null}
    {phase === "INTRO" ? <BattleIntroOverlay battle={battle} rolls={rolls} /> : null}
    {aiBanner ? <div className="ai-action-banner" role="status"><span>{battle.ai.name.toUpperCase()}</span><strong>Choosing a Mystic action</strong></div> : null}
    {rollOutcome ? <div className={`battle-roll-result ${rollOutcome.success ? "success" : "failure"}`} role="status"><span>ROLLED {rollOutcome.roll}</span><strong>{rollOutcome.success ? "SUCCESS" : "FAILED"}</strong></div> : null}
    {inspect ? <BattleInspectOverlay mystic={inspect} onClose={() => setInspect(null)} /> : null}
    {battle.winner && showEnd ? <BattleEndModal battle={battle} rewards={state.lastRewards} boosts={state.activeBoosts} onSummary={() => setShowEnd(false)} /> : null}
  </div>;
}

function BattleTurnBar({ battle, phase }: { battle: NonNullable<ReturnType<typeof useGame>["state"]["battle"]>; phase: BattleUiPhase }) {
  const yourTurn = battle.currentTurn === "player";
  return <header className="battle-turn-bar" key={`${battle.currentTurn}-${battle.turnNumber}`}>
    <div><span className={`battle-turn-dot ${yourTurn ? "player" : "opponent"}`} /><strong>{battle.winner ? "BATTLE COMPLETE" : yourTurn ? "YOUR TURN" : "OPPONENT TURN"}</strong></div>
    <b>TURN {battle.turnNumber}</b>
    <span>{battle.size} × {battle.size}</span>
    <small className="sr-only">{stateCopy[phase]}</small>
  </header>;
}

function BattleMysticRow({ side, team, format, opponentId, selectedId, targetId, targeting, damageFx, onSelect }: { side: "player" | "ai"; team: BattleSide; format: 3 | 5 | 8; opponentId?: string; selectedId: string; targetId?: string; targeting: boolean; damageFx: DamageFx; onSelect: (mystic: Combatant) => void }) {
  const portrait = side === "ai" ? Object.entries(OPPONENT_ART).find(([id]) => opponentId?.toLowerCase().includes(id === "forge" ? "mara" : id === "rookie" ? "lio" : id === "gale" ? "aster" : id === "veil" ? "nox" : id === "regent" ? "regent" : "arch"))?.[1] : undefined;
  return <section className={`battle-side battle-side-${side}`}>
    <BattleSideLabel side={side} name={team.name} portrait={portrait} />
    <div className="battle-mystic-row" role="list" aria-label={`${team.name} lineup`}>
      {team.mystics.map((mystic) => <BattleMysticCard key={mystic.instanceId} mystic={mystic} side={side} format={format} selected={selectedId === mystic.instanceId} targetSelected={targetId === mystic.instanceId} validTarget={targeting && !mystic.defeated} damage={damageFx[mystic.instanceId]} onSelect={() => onSelect(mystic)} />)}
    </div>
  </section>;
}

function BattleSideLabel({ side, name, portrait }: { side: "player" | "ai"; name: string; portrait?: string }) {
  return <div className="battle-side-label">{portrait ? <img src={portrait} alt="" /> : null}<div><span>{side === "ai" ? "OPPONENT" : "YOUR LINEUP"}</span><strong>{name}</strong><small>{side === "ai" ? "RIVAL HANDLER" : "ACTIVE FORMATION"}</small></div></div>;
}

function BattleMysticCard({ mystic, side, format, selected, targetSelected, validTarget, damage, onSelect }: { mystic: Combatant; side: "player" | "ai"; format: 3 | 5 | 8; selected: boolean; targetSelected?: boolean; validTarget: boolean; damage?: { amount: number; key: number }; onSelect: () => void }) {
  const power = Math.max(0, Math.round(mystic.currentPower / mystic.maxPower * 100));
  const color = ORDER_COLORS[mystic.order] ?? "#D7A93B";
  return <button role="listitem" data-vfx-id={mystic.instanceId} className={`battle-mystic-card side-${side} size-${format} ${selected ? "actor-selected" : ""} ${targetSelected ? "target-selected" : ""} ${validTarget ? "valid-target" : ""} ${damage ? "taking-damage" : ""} ${mystic.defeated ? "is-defeated" : ""}`} style={{ "--order-color": color } as React.CSSProperties} onClick={onSelect} disabled={mystic.defeated && !selected} aria-label={`${mystic.name}, ${mystic.currentPower} Power`}>
    {validTarget ? <span className="target-indicator"><Target />TARGET</span> : null}
    {selected && side === "player" ? <span className="acting-indicator"><Swords />ACTING</span> : null}
    {damage ? <FloatingDamage key={damage.key} amount={damage.amount} /> : null}
    <span className="battle-card-frame"><img src={mystic.image ?? ""} alt={`${mystic.name} card`} />{mystic.effects.length || Object.values(mystic.cooldowns).some(Boolean) ? <span className="battle-card-effects"><BattleStatusIcons mystic={mystic} /></span> : null}</span>
    <span className="battle-card-hud"><strong>{mystic.name}</strong><BattlePowerBar percent={power} /><span><b title="Current Power"><Heart />{mystic.currentPower}</b><b title="Effective Defense"><Shield />{effectiveDefense(mystic)}</b><b title="Base Attack"><Swords />{mystic.baseAttack}</b></span></span>
    <span className="battle-card-order">{ORDER_ART[mystic.order] ? <img src={ORDER_ART[mystic.order]} alt="" /> : null}{mystic.order}</span>
    {mystic.defeated ? <span className="defeated-mark"><CircleOff />DEFEATED</span> : null}
  </button>;
}

function BattlePowerBar({ percent }: { percent: number }) {
  const tone = percent > 60 ? "healthy" : percent >= 30 ? "wounded" : "critical";
  return <span className={`battle-power-bar ${tone}`} title={`${percent}% Power remaining`}><i style={{ width: `${percent}%` }} /></span>;
}

function BattleStatusIcons({ mystic }: { mystic: Combatant }) {
  return <>{mystic.effects.map((effect) => <span key={effect.id} title={`${statusLabels[effect.kind]}${effect.value ? ` (${effect.value > 0 ? "+" : ""}${effect.value})` : ""}`}><Activity /></span>)}{Object.entries(mystic.cooldowns).filter(([, turns]) => turns > 0).map(([name, turns]) => <span className="cooldown-status" key={`${name}-${turns}`} title={`${name}: ${turns} turn${turns === 1 ? "" : "s"} remaining`}><Clock3 />{turns}</span>)}</>;
}

function FloatingDamage({ amount }: { amount: number }) { return <span className="floating-damage" aria-live="assertive">−{amount}</span>; }

function BattleControlDeck({ battle, actor, target, selection, playerCanAct, onAction, onInspect }: { battle: NonNullable<ReturnType<typeof useGame>["state"]["battle"]>; actor?: Combatant; target?: Combatant; selection: ActionSelection | null; playerCanAct: boolean; onAction: (action: ActionSelection) => void; onInspect: () => void }) {
  const handlers = battle.player.handlers;
  const [featuredHandlerIndex, setFeaturedHandlerIndex] = useState(0);

  useEffect(() => {
    if (selection?.kind === "handler") setFeaturedHandlerIndex(selection.handlerIndex);
  }, [selection]);
  useEffect(() => {
    setFeaturedHandlerIndex((current) => Math.min(current, Math.max(0, handlers.length - 1)));
  }, [handlers.length]);

  const featuredOwned = handlers[featuredHandlerIndex];
  const featuredHandler = featuredOwned ? catalog.handlers.find((item) => item.id === featuredOwned.definitionId) : undefined;
  return <section className={`battle-control-deck ${playerCanAct ? "active" : "disabled"}`}>
    <div className="battle-controls-main">
      <BattleActorPanel actor={actor} target={target} onInspect={onInspect} />
      <div className="battle-actions">
        <div className="battle-action-grid">
          <BattleActionCard kind="basic" title="Basic Attack" icon={<Swords />} value={actionDamage(actor, target) ?? actor?.baseAttack ?? "—"} detail={target ? "Calculated damage" : "Always hits · choose target"} available={playerCanAct} selected={selection?.kind === "basic"} onClick={() => onAction({ kind: "basic" })} />
          {actor?.moves.map((move, index) => { const cooldown = actor.cooldowns[move.name] ?? 0; const blocked = move.needsReview || cooldown > 0 || actor.effects.some((effect) => effect.kind === "specialLock"); return <BattleActionCard key={move.name} kind="special" title={move.name} icon={<Sparkles />} value={cooldown ? `CD ${cooldown}` : move.minimumRoll ? `${move.minimumRoll}+` : move.exactRoll ?? move.requiredRoll} detail={move.needsReview ? "Needs rules review" : `${move.rawText.split("=").at(-1)?.trim() ?? "Special effect"} · D6`} available={playerCanAct && !blocked} selected={selection?.kind === "special" && selection.moveIndex === index} tooltip={move.needsReview ? move.reviewReason : cooldown ? `This move is on cooldown for ${cooldown} more turn${cooldown === 1 ? "" : "s"}.` : `Roll ${move.minimumRoll ? `${move.minimumRoll}+` : move.exactRoll ?? move.requiredRoll} on one D6.`} onClick={() => onAction({ kind: "special", moveIndex: index })} />; })}
        </div>
      </div>
    </div>
    <BattleHandlerShowcase
      handler={featuredHandler}
      usesRemaining={featuredOwned ? featuredOwned.maxUses - featuredOwned.uses : 0}
      handlerIndex={featuredHandlerIndex}
      handlerCount={handlers.length}
      selected={selection?.kind === "handler" && selection.handlerIndex === featuredHandlerIndex}
      disabled={!playerCanAct || !featuredOwned || featuredOwned.uses >= featuredOwned.maxUses}
      onShowHandler={setFeaturedHandlerIndex}
      onActivate={() => onAction({ kind: "handler", handlerIndex: featuredHandlerIndex })}
    />
  </section>;
}

function BattleHandlerShowcase({ handler, usesRemaining, handlerIndex, handlerCount, selected, disabled, onShowHandler, onActivate }: { handler?: HandlerDefinition; usesRemaining: number; handlerIndex: number; handlerCount: number; selected: boolean; disabled: boolean; onShowHandler: (index: number) => void; onActivate: () => void }) {
  if (!handler) return <section className="battle-handler-showcase empty"><WandSparkles /><strong>No Handler equipped</strong></section>;
  return <section className="battle-handler-showcase">
    <header><span>HANDLER CARD</span><small>{usesRemaining} use{usesRemaining === 1 ? "" : "s"} remaining</small></header>
    {handlerCount > 1 ? <nav className="battle-handler-picker" aria-label="Equipped Handler cards">{Array.from({ length: handlerCount }, (_, index) => <button key={index} type="button" className={index === handlerIndex ? "active" : ""} onClick={() => onShowHandler(index)} aria-label={`Show Handler card ${index + 1}`} aria-current={index === handlerIndex ? "true" : undefined} />)}</nav> : null}
    <div className="battle-handler-art">{handler.image ? <img src={handler.image} alt={`${handler.name} Handler card`} /> : <div className="artwork-needed">Artwork needed</div>}</div>
    <button type="button" className={`battle-handler-move ${selected ? "selected" : ""}`} disabled={disabled} onClick={onActivate} title={disabled ? `${handler.name} cannot be used right now.` : handler.effect}>
      <span className="handler-move-icon"><WandSparkles /></span>
      <span><small>HANDLER MOVE</small><strong>{handler.effectType}</strong><em>{handler.effect}</em></span>
      <b>ROLL {handler.exactRoll ? handler.activationRoll : `${handler.activationRoll}+`}</b>
    </button>
  </section>;
}

function BattleActorPanel({ actor, target, onInspect }: { actor?: Combatant; target?: Combatant; onInspect: () => void }) {
  return <aside className="battle-actor-panel">{actor?.image ? <img src={actor.image} alt="" /> : null}<span>ACTOR</span><h2>{actor?.name ?? "Choose a Mystic"}</h2><p>{target ? <>Targeting <strong>{target.name}</strong></> : "No target selected"}</p>{actor ? <button onClick={onInspect}><Eye />Inspect card</button> : null}</aside>;
}

function BattleActionCard({ kind, title, icon, value, detail, available, selected, tooltip, onClick }: { kind: "basic" | "special"; title: string; icon: React.ReactNode; value: string | number; detail: string; available: boolean; selected: boolean; tooltip?: string; onClick: () => void }) {
  return <button className={`battle-action-card ${kind} ${selected ? "selected" : ""}`} disabled={!available} title={!available ? tooltip : undefined} onClick={onClick}><span className="action-icon">{icon}</span><span><small>{kind === "basic" ? "ATTACK" : "SPECIAL MOVE"}</small><strong>{title}</strong><em>{detail}</em></span><b>{value}</b>{!available && tooltip ? <i><Info />{tooltip}</i> : null}</button>;
}

function BattleDiceTray({ requirement, diceCount, rolling, holding, face, onRoll, onCancel }: { requirement: string; diceCount: number; rolling: boolean; holding: boolean; face: number; onRoll: () => void; onCancel: () => void }) {
  return <div className={`battle-dice-tray ${holding ? "holding" : ""}`} aria-live="polite"><div><small>{holding ? "ROLL RESULT" : `ROLL ${diceCount}D6`}</small><strong>{holding ? `Rolled ${face}` : `Need ${requirement} to succeed`}</strong></div><div className="battle-dice">{Array.from({ length: diceCount }, (_, index) => <BattleDie key={index} face={face} rolling={rolling && !holding} />)}</div><button className="button dice-roll-button" disabled={rolling} onClick={onRoll}><Dices />{holding ? "RESULT" : rolling ? "ROLLING…" : "ROLL"}</button><button className="dice-cancel" disabled={rolling} onClick={onCancel}>Cancel</button></div>;
}

function BattleDie({ face, rolling }: { face: number; rolling: boolean }) { return <span className={`battle-die ${rolling ? "rolling" : ""}`} aria-label={`Die showing ${face}`}>{face}</span>; }

const battleLogInset = 8;

function getBattleBoardBounds() {
  return document.querySelector<HTMLElement>(".battle-board-column")?.getBoundingClientRect();
}

function fitBattleLogSize(width: number, height: number, board: DOMRect) {
  const maxWidth = Math.max(1, board.width - battleLogInset * 2);
  const maxHeight = Math.max(1, board.height - battleLogInset * 2);
  return {
    width: Math.min(maxWidth, Math.max(Math.min(240, maxWidth), width)),
    height: Math.min(maxHeight, Math.max(Math.min(150, maxHeight), height)),
  };
}

function clampBattleLogPosition(x: number, y: number, width: number, height: number, board: DOMRect) {
  const minX = board.left + battleLogInset;
  const minY = board.top + battleLogInset;
  const maxX = Math.max(minX, board.right - width - battleLogInset);
  const maxY = Math.max(minY, board.bottom - height - battleLogInset);
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
}

function BattleLog({ events }: { events: BattleEvent[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ left: number; top: number } | null>(null);
  const nearBottom = useRef(true);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [boardLimit, setBoardLimit] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    try {
      const panel = panelRef.current?.getBoundingClientRect();
      const board = getBattleBoardBounds();
      if (!panel || !board) return;
      const savedPosition = localStorage.getItem("mini-mystics.battle-log-position");
      const savedSize = localStorage.getItem("mini-mystics.battle-log-size");
      const savedMinimized = localStorage.getItem("mini-mystics.battle-log-minimized") === "true";
      const parsedPosition = savedPosition ? JSON.parse(savedPosition) as { x?: number; y?: number } : null;
      const parsedSize = savedSize ? JSON.parse(savedSize) as { width?: number; height?: number } : null;
      const nextSize = fitBattleLogSize(Number(parsedSize?.width) || panel.width, Number(parsedSize?.height) || panel.height, board);
      const visibleWidth = savedMinimized ? Math.min(230, board.width - battleLogInset * 2) : nextSize.width;
      const visibleHeight = savedMinimized ? Math.min(42, board.height - battleLogInset * 2) : nextSize.height;
      const nextPosition = clampBattleLogPosition(Number(parsedPosition?.x) || panel.left, Number(parsedPosition?.y) || panel.top, visibleWidth, visibleHeight, board);
      setBoardLimit({ width: board.width - battleLogInset * 2, height: board.height - battleLogInset * 2 });
      setSize(nextSize);
      setPosition(nextPosition);
      setMinimized(savedMinimized);
    } catch { /* Ignore invalid saved panel state. */ }
  }, []);
  useEffect(() => {
    const constrainPanel = () => {
      const panel = panelRef.current?.getBoundingClientRect();
      const board = getBattleBoardBounds();
      if (!panel || !board) return;
      setBoardLimit({ width: board.width - battleLogInset * 2, height: board.height - battleLogInset * 2 });
      if (!minimized) {
        const nextSize = fitBattleLogSize(panel.width, panel.height, board);
        setSize((current) => current?.width === nextSize.width && current.height === nextSize.height ? current : nextSize);
      }
      const displayWidth = Math.min(panel.width, board.width - battleLogInset * 2);
      const displayHeight = Math.min(panel.height, board.height - battleLogInset * 2);
      setPosition((current) => {
        const next = clampBattleLogPosition(current?.x ?? panel.left, current?.y ?? panel.top, displayWidth, displayHeight, board);
        if (current && next.x === current.x && next.y === current.y) return current;
        localStorage.setItem("mini-mystics.battle-log-position", JSON.stringify(next));
        return next;
      });
    };
    const frame = window.requestAnimationFrame(constrainPanel);
    const board = document.querySelector<HTMLElement>(".battle-board-column");
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(constrainPanel);
    if (board) observer?.observe(board);
    window.addEventListener("resize", constrainPanel);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", constrainPanel); };
  }, [minimized]);
  useEffect(() => { if (nearBottom.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [events.length]);

  const movePanel = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current || !panelRef.current) return;
    const board = getBattleBoardBounds();
    if (!board) return;
    const bounds = panelRef.current.getBoundingClientRect();
    setPosition(clampBattleLogPosition(event.clientX - dragRef.current.offsetX, event.clientY - dragRef.current.offsetY, bounds.width, bounds.height, board));
  };
  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const bounds = panelRef.current?.getBoundingClientRect();
    if (bounds) localStorage.setItem("mini-mystics.battle-log-position", JSON.stringify({ x: bounds.left, y: bounds.top }));
  };
  const resizePanel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    const board = getBattleBoardBounds();
    if (!board) return;
    const maxWidth = Math.max(1, board.right - resizeRef.current.left - battleLogInset);
    const maxHeight = Math.max(1, board.bottom - resizeRef.current.top - battleLogInset);
    setSize({
      width: Math.min(maxWidth, Math.max(Math.min(240, maxWidth), event.clientX - resizeRef.current.left)),
      height: Math.min(maxHeight, Math.max(Math.min(150, maxHeight), event.clientY - resizeRef.current.top)),
    });
  };
  const finishResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const bounds = panelRef.current?.getBoundingClientRect();
    if (bounds) localStorage.setItem("mini-mystics.battle-log-size", JSON.stringify({ width: bounds.width, height: bounds.height }));
  };
  const toggleMinimized = () => setMinimized((current) => {
    localStorage.setItem("mini-mystics.battle-log-minimized", String(!current));
    return !current;
  });
  const panelStyle: React.CSSProperties = {
    ...(position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : {}),
    ...(!minimized && size ? { width: size.width, height: size.height } : {}),
    ...(minimized && boardLimit ? { width: Math.min(230, boardLimit.width), height: Math.min(42, boardLimit.height) } : {}),
  };

  return <aside ref={panelRef} className={`battle-event-log floating-battle-log ${minimized ? "minimized" : ""}`} style={panelStyle}><header onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button") || !panelRef.current) return; const bounds = panelRef.current.getBoundingClientRect(); dragRef.current = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top }; setPosition({ x: bounds.left, y: bounds.top }); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={movePanel} onPointerUp={finishDrag} onPointerCancel={finishDrag}><span><GripHorizontal /><ScrollText />BATTLE LOG</span><span className="battle-log-tools"><small>{events.length} events</small><button type="button" onClick={toggleMinimized} aria-label={minimized ? "Restore battle log" : "Minimize battle log"} title={minimized ? "Restore battle log" : "Minimize battle log"}>{minimized ? <Maximize2 /> : <Minus />}</button></span></header>{!minimized ? <><div className="battle-event-list" ref={listRef} onScroll={(event) => { const element = event.currentTarget; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40; }}>{events.map((event) => <BattleEventRow key={event.id} event={event} />)}</div><button type="button" className="battle-log-resize-handle" aria-label="Resize battle log" title="Drag to resize" onPointerDown={(event) => { if (!panelRef.current) return; event.preventDefault(); const bounds = panelRef.current.getBoundingClientRect(); resizeRef.current = { left: bounds.left, top: bounds.top }; setPosition({ x: bounds.left, y: bounds.top }); setSize({ width: bounds.width, height: bounds.height }); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={resizePanel} onPointerUp={finishResize} onPointerCancel={finishResize}><GripHorizontal /></button></> : null}</aside>;
}

function BattleEventRow({ event }: { event: BattleEvent }) { return <div className={`battle-event event-${event.type}`}><span>T{event.turn}</span><p>{event.message}</p></div>; }

function BattleIntroOverlay({ battle, rolls }: { battle: NonNullable<ReturnType<typeof useGame>["state"]["battle"]>; rolls: { player: number; opponent: number } }) {
  return <div className="battle-overlay battle-intro"><div className="intro-versus"><section><small>YOUR ROLL</small><BattleDie face={rolls.player} rolling={false} /><strong>{battle.player.name}</strong></section><span>VS</span><section><small>RIVAL ROLL</small><BattleDie face={rolls.opponent} rolling={false} /><strong>{battle.ai.name}</strong></section></div><p>{battle.currentTurn === "player" ? "You act first" : `${battle.ai.name} acts first`}</p></div>;
}

function BattleInspectOverlay({ mystic, onClose }: { mystic: Combatant; onClose: () => void }) {
  useEffect(() => { const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, [onClose]);
  return <div className="battle-inspect-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="battle-inspect" role="dialog" aria-modal="true" aria-label={`${mystic.name} battle details`}><button className="icon-button" onClick={onClose} aria-label="Close inspection"><X /></button><img src={mystic.image ?? ""} alt={`${mystic.name} card`} /><div><span>{mystic.order} · {mystic.rarity}</span><h2>{mystic.name}</h2><div className="inspect-combat-stats"><b><Heart />{mystic.currentPower}/{mystic.maxPower}<small>POWER</small></b><b><Shield />{effectiveDefense(mystic)}<small>DEFENSE</small></b><b><Swords />{mystic.baseAttack}<small>ATTACK</small></b></div><h3>Moves</h3>{mystic.moves.map((move) => <article key={move.name}><strong>{move.name}</strong><span>{move.rawText}</span><small>{(mystic.cooldowns[move.name] ?? 0) ? `Cooldown: ${mystic.cooldowns[move.name]} turns` : "Ready"}</small></article>)}<h3>Status effects</h3>{mystic.effects.length ? mystic.effects.map((effect) => <p key={effect.id}>{statusLabels[effect.kind]} {effect.value ? `(${effect.value > 0 ? "+" : ""}${effect.value})` : ""}</p>) : <p>No active effects</p>}</div></section></div>;
}

function BattleEndModal({ battle, rewards, boosts, onSummary }: { battle: NonNullable<ReturnType<typeof useGame>["state"]["battle"]>; rewards: { xp: number; coins: number; won: boolean } | null; boosts: { xp: { matches: number; multiplier: 2 } | null; coins: { matches: number; multiplier: 2 } | null }; onSummary: () => void }) {
  const victory = battle.winner === "player";
  const defeated = battle.ai.mystics.filter((mystic) => mystic.defeated).length;
  const survivors = battle.player.mystics.filter((mystic) => !mystic.defeated).length;
  return <div className="battle-overlay end-overlay"><section className={`battle-end-modal ${victory ? "victory" : "defeat"}`} role="dialog" aria-modal="true"><span>{victory ? <Trophy /> : <Shield />}</span><small>MATCH COMPLETE</small><h2>{victory ? "VICTORY" : "DEFEAT"}</h2><p>{victory ? `${battle.ai.name}'s formation has fallen.` : "Your formation was defeated, but the archive records every battle."}</p><div className="battle-rewards"><div><Sparkles /><b>+{rewards?.xp ?? 0}</b><small>XP EARNED{boosts.xp ? " · 2× ACTIVE" : ""}</small></div><div><Zap /><b>+{rewards?.coins ?? 0}</b><small>COINS{boosts.coins ? " · 2× ACTIVE" : ""}</small></div><div><Swords /><b>{defeated}</b><small>MYSTICS DEFEATED</small></div><div><Heart /><b>{survivors}</b><small>SURVIVORS</small></div></div><div className="battle-end-actions"><Link href="/campaign" className="button primary">Continue <ArrowRight /></Link><button className="button ghost" onClick={onSummary}>View match summary</button></div></section></div>;
}
