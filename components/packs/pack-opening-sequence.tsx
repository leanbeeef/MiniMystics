"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { PACK_ART, ORDER_COLORS } from "@/lib/art";
import { audioManager } from "@/lib/audio/manager";
import { useSettings } from "../settings-provider";

type Props = { name: string; packId: string; order?: string; animated: boolean; onComplete: () => void };

/** Wrapper identity depends only on pack type / selected Order, never reward rarity. */
export function packIdentity(packId: string, order?: string) {
  return {
    image: PACK_ART[packId === "order" ? order ?? "" : packId === "starter" ? "standard" : packId],
    color: ORDER_COLORS[packId === "void" ? "Void" : order ?? ""] ?? "#d7b56d",
  };
}

// Separate clipped layers leave the tear seam available for a future drag gesture.
function PackWrapper({ image }: { image: string }) {
  return <div className="booster-wrapper">
    <div className="booster-interior" />
    <img className="booster-piece booster-left" src={image} alt="" />
    <img className="booster-piece booster-right" src={image} alt="" />
    <img className="booster-piece booster-tear" src={image} alt="" />
  </div>;
}
function PackCards() {
  // A fixed decorative stack avoids hinting at bonus rewards or rarity.
  return <div className="booster-cards">{[0, 1, 2].map((index) =>
    <img key={index} src="/cards/Mystics/back.png" alt="" className="booster-card" />)}</div>;
}

export function PackOpeningSequence({ name, packId, order, animated, onComplete }: Props) {
  const { config, settings } = useSettings();
  const root = useRef<HTMLDivElement>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const started = useRef(false);
  const completed = useRef(false);
  const sounded = useRef(false);
  const [phase, setPhase] = useState<"ready" | "opening">("ready");
  const identity = packIdentity(packId, order);
  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    animation.current?.kill();
    onComplete();
  };
  const tearSound = () => {
    if (sounded.current) return;
    sounded.current = true;
    audioManager.unlock();
    audioManager.playSFX("pack-open");
  };

  useEffect(() => {
    if (!animated) { tearSound(); complete(); return; }
    if (!root.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(".booster-object", { opacity: 0, y: config.reduced ? 0 : 18, scale: config.reduced ? 1 : .9 },
        { opacity: 1, y: 0, scale: 1, duration: .35, ease: "back.out(1.15)" });
    }, root);
    return () => { animation.current?.kill(); context.revert(); };
  }, [config.reduced, animated]);

  const open = () => {
    if (started.current) return;
    started.current = true;
    if (!animated || !identity.image) { tearSound(); complete(); return; }
    setPhase("opening");
    const select = gsap.utils.selector(root);
    const timeline = gsap.timeline({ onComplete: complete });
    animation.current = timeline;
    if (config.reduced) {
      tearSound();
      timeline.to(select(".booster-glow"), { opacity: .5, duration: .15 })
        .to(select(".booster-wrapper"), { opacity: 0, duration: .2 })
        .to(select(".booster-cards"), { opacity: 1, duration: .15 }, "<")
        .to(root.current, { opacity: 0, duration: .15 });
      return;
    }
    timeline.to(select(".booster-object"), { scaleX: 1.035, scaleY: 1.02, duration: .12 })
      .to(select(".booster-wrapper"), { rotation: settings.visual.screenShake ? -1.5 : 0, duration: .06 })
      .to(select(".booster-wrapper"), { rotation: settings.visual.screenShake ? 1.5 : 0, duration: .06 })
      .addLabel("tear", .24).call(tearSound, [], "tear")
      .to(select(".booster-wrapper"), { rotation: 0, duration: .1 }, "tear")
      .to(select(".booster-tear"), { xPercent: 28, yPercent: -22, rotation: 18, opacity: 0, duration: .4, ease: "power2.out" }, "tear")
      .to(select(".booster-left"), { xPercent: -12, rotation: -8, duration: .45, transformOrigin: "50% 100%" }, .42)
      .to(select(".booster-right"), { xPercent: 12, rotation: 8, duration: .45, transformOrigin: "50% 100%" }, .42)
      .to(select(".booster-glow"), { opacity: config.flash ? .85 : .45, scale: 1.15, duration: .4 }, .48)
      .to(select(".booster-cards"), { opacity: 1, yPercent: -42, duration: .55, ease: "power2.out" }, .68)
      .to(select(".booster-card"), { rotation: (index: number) => (index - 1) * 5, xPercent: (index: number) => (index - 1) * 7, duration: .4 }, .85)
      .to(select(".booster-wrapper"), { opacity: 0, y: 30, duration: .35 }, 1.05)
      .to(root.current, { opacity: 0, duration: .25 }, 1.35);
    const particles = select(".booster-particle");
    if (particles.length) timeline.fromTo(particles, { opacity: 1 }, {
      x: (index: number) => Math.cos(index * 2.4) * 95,
      y: (index: number) => -25 - (index % 4) * 18,
      rotation: (index: number) => index * 43, opacity: 0, duration: .5,
    }, "tear");
  };

  if (!animated) return null;
  return <div ref={root} className="booster-stage" style={{ "--pack-energy": identity.color } as CSSProperties}>
    <header><span className="eyebrow">PACK CHAMBER</span><h1>{name}</h1><p role="status">{phase === "ready" ? "A sealed pack. A new possibility." : "Opening your pack…"}</p></header>
    <div className="booster-display">
      <div className="booster-object" aria-hidden="true">
        <div className="booster-glow" /><PackCards />
        {identity.image ? <PackWrapper image={identity.image} /> : <div className="booster-art-missing">{name}</div>}
        {!config.reduced && config.particles > 0 ? Array.from({ length: config.particles < 1 ? 6 : 12 }, (_, index) => <i className="booster-particle" key={index} />) : null}
      </div>
      <button className="booster-hit-target" aria-label={`Open ${name}`} disabled={phase !== "ready"} onClick={open} />
    </div>
    <div className="booster-actions">{phase === "ready" ? <button className="button primary" onClick={open}>OPEN PACK</button>
      : <button className="button ghost" onClick={() => { tearSound(); complete(); }}>SKIP</button>}</div>
  </div>;
}
