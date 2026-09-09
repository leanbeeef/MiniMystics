import { gsap } from "gsap";
import { DICE_RESULT_HOLD_MS, diceSettleDuration, type AnimationConfig } from "./config";
import type { PresentationAction } from "./battle-events";
import { ORDER_COLORS } from "../art";
/** All movement belongs to a disposable GSAP timeline, scoped to this battle. */
export function attackTimeline(root: HTMLElement, action: PresentationAction, config: AnimationConfig, onImpact: () => void, onComplete: () => void, onRollStage?: (stage: "holding" | null) => void) {
  const find = (id?: string) => [...root.querySelectorAll<HTMLElement>("[data-vfx-id]")].find((node) => node.dataset.vfxId === id);
  const source = find(action.actor?.instanceId)?.querySelector<HTMLElement>(".battle-card-frame");
  const target = find(action.target?.instanceId)?.querySelector<HTMLElement>(".battle-card-frame");
  const total = config[action.durationKind] / 1000;
  const spin = action.roll && !config.reduced ? total * .45 : 0;
  // Let the die finish settling, then give players a full second to read it.
  const hold = action.roll ? (diceSettleDuration(config) + DICE_RESULT_HOLD_MS) / 1000 : 0;
  const effectStart = spin + hold;
  const duration = action.roll ? total * (config.reduced ? .6 : .35) : total;
  let projectile: HTMLSpanElement | undefined;
  const timeline = gsap.timeline({ onComplete: () => { projectile?.remove(); onComplete(); }, onInterrupt: () => projectile?.remove() });
  if (action.roll) {
    if (spin) timeline.call(() => onRollStage?.("holding"), [], spin);
    timeline.call(() => onRollStage?.(null), [], effectStart);
  }
  const direction = action.actor && root.querySelector(`.battle-side-player [data-vfx-id="${CSS.escape(action.actor.instanceId)}"]`) ? -1 : 1;
  if (source) timeline.to(source, { y: direction * config.distance, scale: config.cinematic && action.durationKind === "apex" ? 1.2 : action.special ? 1.05 : 1.02, duration: duration * .3, ease: "power2.out", ...(config.reduced ? { scale: 1, opacity: .8 } : {}) }, effectStart);
  if (source && target && source !== target && !action.failed && !config.reduced && config.particles > 0) {
    const bounds = root.getBoundingClientRect();
    const start = source.getBoundingClientRect(); const end = target.getBoundingClientRect();
    projectile = document.createElement("span");
    projectile.className = "battle-attack-trail";
    projectile.style.opacity = "0";
    projectile.setAttribute("aria-hidden", "true");
    projectile.style.background = action.actor ? ORDER_COLORS[action.actor.order] : "#d7a93b";
    root.appendChild(projectile);
    timeline.fromTo(projectile, { x: start.left - bounds.left + start.width / 2, y: start.top - bounds.top + start.height / 2, opacity: 0, scale: action.special || action.advantage ? 1.5 : 1 }, { x: end.left - bounds.left + end.width / 2, y: end.top - bounds.top + end.height / 2, opacity: .75, immediateRender: false, duration: duration * .2, ease: "power2.in" }, effectStart + duration * .12)
      .to(projectile, { opacity: 0, duration: duration * .1 }, effectStart + duration * .32);
  }
  timeline.call(onImpact, [], effectStart + duration * .32);
  if (target && target !== source && !action.failed && !config.reduced) {
    timeline.to(target, { x: action.miss ? 12 : action.special ? 5 : 3, duration: duration * .08 }, effectStart + duration * .33)
      .to(target, { x: action.miss ? 0 : -3, duration: duration * .08 }, effectStart + duration * .41)
      .to(target, { x: 0, duration: duration * .12 }, effectStart + duration * .49);
  }
  if (config.shake && action.special && !action.failed && !action.miss) {
    const arena = root.querySelector(".battle-arena");
    if (arena) timeline.to(arena, { x: 3, duration: .045, repeat: 3, yoyo: true }, effectStart + duration * .34).to(arena, { x: 0, duration: .08 });
  }
  if (action.advantage) {
    const icon = find(action.actor?.instanceId)?.querySelector(".battle-card-order");
    if (icon) timeline.fromTo(icon, { opacity: .55 }, { opacity: 1, duration: duration * .35 }, effectStart + duration * .32);
  }
  if (source) timeline.to(source, { y: 0, scale: 1, opacity: 1, duration: duration * .35, ease: "power2.inOut" }, effectStart + duration * .6);
  timeline.to({}, { duration: duration * .05 }, effectStart + duration * .95);
  return timeline;
}
