"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "motion/react";
import type { BattleState } from "@/lib/game/types";
import { battlePresentation, type CombatFeedback, type PresentationAction } from "@/lib/animations/battle-events";
import { attackTimeline } from "@/lib/animations/attack-animations";
import { ORDER_BATTLE_EFFECT } from "@/lib/vfx/presets";
import { ORDER_COLORS } from "@/lib/art";
import { audioManager } from "@/lib/audio/manager";
import { useSettings } from "../settings-provider";
import { useVFX } from "../vfx/vfx-manager";

export function useBattlePresentation(battle: BattleState | null, root: RefObject<HTMLDivElement | null>) {
  const { config } = useSettings();
  const { playBattleEffect } = useVFX();
  const previous = useRef(battle);
  const [display, setDisplay] = useState(battle);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<PresentationAction | null>(null);
  const [roll, setRoll] = useState<({ face: number; required: number; success: boolean; stage: "rolling" | "holding" }) | null>(null);
  const [feedback, setFeedback] = useState<CombatFeedback[]>([]);
  const timeline = useRef<ReturnType<typeof attackTimeline> | null>(null);
  const clearText = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentConfig = useRef(config); currentConfig.current = config;
  useEffect(() => {
    const before = previous.current;
    previous.current = battle;
    if (!battle || !before || before.id !== battle.id || !root.current) { setDisplay(battle); setBusy(false); setFeedback([]); setAction(null); setRoll(null); timeline.current?.revert(); return; }
    const next = battlePresentation(before, battle);
    if (!next) { if (!timeline.current?.isActive()) setDisplay(battle); return; }
    timeline.current?.revert(); clearTimeout(clearText.current);
    const options = currentConfig.current;
    setBusy(true); setAction(next); setFeedback([]);
    setRoll(next.roll ? { ...next.roll, success: !next.failed, stage: options.reduced ? "holding" : "rolling" } : null);
    audioManager.playSFX(next.special ? "special-charge" : "attack-basic");
    timeline.current = attackTimeline(root.current, next, options, () => {
      setDisplay(battle); setFeedback(next.feedback);
      if (next.failed) audioManager.playSFX("special-fail");
      else if (next.miss) audioManager.playSFX("attack-miss");
      else audioManager.playSFX(next.special ? "special-success" : "attack-hit");
      if (next.advantage) audioManager.playSFX("order-advantage");
      const color = next.actor ? ORDER_COLORS[next.actor.order] : undefined;
      for (const item of next.feedback.slice(0, options.maxEffects)) {
        if (["miss", "failed", "advantage"].includes(item.kind)) continue;
        const effect = item.kind === "damage" ? next.special && next.actor ? ORDER_BATTLE_EFFECT[next.actor.order] ?? "impact" : "impact" : item.kind === "defeat" ? "ko" : item.kind === "cooldown" ? "buff" : item.kind;
        if (effect === "miss" || effect === "failed" || effect === "advantage") continue;
        playBattleEffect(effect, { targetId: item.targetId, accentColor: color, intensity: next.durationKind === "apex" ? "apex" : next.special ? "high" : "low" });
        if (["heal", "shield", "buff", "debuff", "cooldown"].includes(item.kind)) audioManager.playSFX(item.kind as "heal" | "shield" | "buff" | "debuff" | "cooldown");
        if (item.kind === "defeat") audioManager.playSFX("mystic-defeat");
      }
    }, () => { setBusy(false); setAction(null); clearText.current = setTimeout(() => setFeedback([]), 250); }, (stage) => setRoll((current) => current && stage ? { ...current, stage } : null));
  }, [battle, root, playBattleEffect]);
  // Accessibility changes can cancel an in-flight cinematic immediately.
  useEffect(() => {
    timeline.current?.revert(); timeline.current = null;
    setBusy(false); setAction(null); setRoll(null); setFeedback([]); setDisplay(previous.current);
  }, [config]);
  useEffect(() => () => { timeline.current?.revert(); clearTimeout(clearText.current); }, []);
  const pending = battle?.id === previous.current?.id && battle?.events.at(-1)?.id !== previous.current?.events.at(-1)?.id;
  return { display: display?.id === battle?.id ? display : battle, busy: busy || pending, action, roll, feedback };
}
export function CombatText({ feedback }: { feedback: CombatFeedback[] }) {
  const { config } = useSettings();
  if (!config.floatingText || !feedback.length) return null;
  return <span className="combat-text-stack" aria-live="polite">{feedback.map((item, index) => <motion.span key={`${item.kind}-${index}-${item.text}`} className={`combat-text combat-text-${item.kind}`} initial={{ opacity: 0, y: config.reduced ? 0 : 8 }} animate={{ opacity: [0, 1, 1, 0], y: config.reduced ? 0 : -18 }} transition={{ duration: Math.max(.4, config.basic / 1000), times: [0, .1, .8, 1] }}>{item.text}</motion.span>)}</span>;
}
export function SpecialAnnouncement({ action }: { action: PresentationAction | null }) {
  const { config } = useSettings();
  if (!action?.special) return null;
  return <motion.div className={`special-announcement ${config.cinematic && action.durationKind === "apex" ? "apex-sequence" : ""}`} style={{ "--order-color": action.actor ? ORDER_COLORS[action.actor.order] : undefined } as React.CSSProperties} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status"><small>{action.actor?.rarity === "Apex" ? "APEX SPECIAL" : "SPECIAL MOVE"} · {action.actor?.name}</small><strong>{action.name}</strong></motion.div>;
}
