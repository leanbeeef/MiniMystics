"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { BATTLE_VFX, PACK_VFX, type BattleEffectName, type PackEffectName, type VfxIntensity, type VfxPreset } from "@/lib/vfx/presets";

export type VfxOptions = {
  targetId?: string;
  position?: { x: number; y: number };
  intensity?: VfxIntensity;
  vfxTheme?: string;
  accentColor?: string;
  particlePreset?: VfxPreset["particlePreset"];
  revealIntensity?: VfxIntensity;
  backgroundEffect?: VfxPreset["backgroundEffect"];
  audioHook?: string;
};

type VfxContextValue = {
  playBattleEffect: (effect: BattleEffectName, options?: VfxOptions) => number;
  playPackEffect: (effect: PackEffectName, options?: VfxOptions) => number;
  emitAudioHook: (event: string) => void;
};

type PixiRuntime = {
  app: import("pixi.js").Application;
  Emitter: typeof import("@pixi/particle-emitter").Emitter;
  Texture: typeof import("pixi.js").Texture;
  Graphics: typeof import("pixi.js").Graphics;
};

const VfxContext = createContext<VfxContextValue>({ playBattleEffect: () => 0, playPackEffect: () => 0, emitAudioHook: () => undefined });
const intensityCount: Record<VfxIntensity, number> = { low: 7, medium: 13, high: 22, apex: 34 };

export function VFXManager({ scope, children }: { scope: "battle" | "pack"; children: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<PixiRuntime | null>(null);

  useEffect(() => {
    let active = true;
    let app: import("pixi.js").Application | undefined;
    const host = hostRef.current;
    if (!host) return;

    void Promise.all([import("pixi.js"), import("@pixi/particle-emitter")]).then(([pixi, particles]) => {
      if (!active || !hostRef.current) return;
      app = new pixi.Application({ resizeTo: hostRef.current, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
      app.stage.eventMode = "none";
      const canvas = app.view as HTMLCanvasElement;
      canvas.setAttribute("aria-hidden", "true");
      hostRef.current.appendChild(canvas);
      runtimeRef.current = { app, Emitter: particles.Emitter, Texture: pixi.Texture, Graphics: pixi.Graphics };
    });

    return () => {
      active = false;
      runtimeRef.current = null;
      app?.destroy(true, { children: true, texture: false, baseTexture: false });
    };
  }, []);

  const play = useCallback((preset: VfxPreset, options: VfxOptions = {}) => {
    const runtime = runtimeRef.current;
    const host = hostRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const requestedIntensity = options.intensity ?? options.revealIntensity ?? preset.revealIntensity;
    const duration = reducedMotion ? Math.min(280, preset.duration) : preset.duration;
    const audioHook = options.audioHook;
    if (audioHook) window.dispatchEvent(new CustomEvent("mini-mystics:audio", { detail: { event: audioHook } }));
    if (!runtime || !host) return duration;

    const hostRect = host.getBoundingClientRect();
    const target = options.targetId ? [...host.querySelectorAll<HTMLElement>("[data-vfx-id]")].find((element) => element.dataset.vfxId === options.targetId) : null;
    const targetRect = target?.getBoundingClientRect();
    const point = options.position ?? {
      x: targetRect ? targetRect.left - hostRect.left + targetRect.width / 2 : hostRect.width / 2,
      y: targetRect ? targetRect.top - hostRect.top + targetRect.height / 2 : hostRect.height / 2,
    };
    const accent = (options.accentColor || preset.accentColor || "#f2c14e").replace("#", "");
    const count = reducedMotion ? Math.min(4, intensityCount[requestedIntensity]) : intensityCount[requestedIntensity];
    const speed = reducedMotion ? [8, 24] as [number, number] : preset.speed;

    const emitter = new runtime.Emitter(runtime.app.stage, {
      lifetime: { min: Math.max(.2, duration / 1800), max: Math.max(.28, duration / 1050) },
      frequency: .012,
      particlesPerWave: Math.max(1, Math.ceil(count / 4)),
      emitterLifetime: Math.min(.18, duration / 4000),
      maxParticles: count,
      pos: point,
      emit: true,
      autoUpdate: true,
      behaviors: [
        { type: "alpha", config: { alpha: { list: [{ time: 0, value: .92 }, { time: .68, value: .64 }, { time: 1, value: 0 }] } } },
        { type: "scale", config: { scale: { list: [{ time: 0, value: (options.particlePreset ?? preset.particlePreset) === "star" ? .32 : .2 }, { time: .45, value: (options.particlePreset ?? preset.particlePreset) === "fragment" ? .4 : .13 }, { time: 1, value: .03 }] }, minMult: .45 } },
        { type: "colorStatic", config: { color: accent } },
        { type: "moveSpeed", config: { speed: { list: [{ time: 0, value: speed[1] }, { time: 1, value: speed[0] }] }, minMult: .55 } },
        { type: "rotation", config: { minStart: 0, maxStart: 360, minSpeed: -90, maxSpeed: 90, accel: 0 } },
        { type: "spawnShape", config: { type: "torus", data: { x: 0, y: 0, radius: reducedMotion ? 4 : 11, innerRadius: 1, affectRotation: true } } },
        { type: "textureSingle", config: { texture: runtime.Texture.WHITE } },
      ],
    });
    emitter.playOnceAndDestroy();

    const backgroundEffect = reducedMotion ? "glow" : options.backgroundEffect ?? preset.backgroundEffect;
    if (backgroundEffect !== "none") {
      const graphic = new runtime.Graphics();
      const color = Number.parseInt(accent, 16);
      const radius = targetRect ? Math.min(targetRect.width, targetRect.height) * .38 : 38;
      if (backgroundEffect === "ring" || backgroundEffect === "starburst") graphic.lineStyle(backgroundEffect === "starburst" ? 2 : 1.5, color, .72).drawCircle(point.x, point.y, radius);
      else graphic.beginFill(color, .12).drawCircle(point.x, point.y, radius * .82).endFill();
      if (backgroundEffect === "starburst") {
        graphic.lineStyle(1, color, .55);
        for (let index = 0; index < 12; index += 1) {
          const angle = index / 12 * Math.PI * 2;
          graphic.moveTo(point.x + Math.cos(angle) * radius * .55, point.y + Math.sin(angle) * radius * .55);
          graphic.lineTo(point.x + Math.cos(angle) * radius * 1.35, point.y + Math.sin(angle) * radius * 1.35);
        }
      }
      runtime.app.stage.addChildAt(graphic, 0);
      let elapsed = 0;
      const tick = (delta: number) => {
        elapsed += delta / 60 * 1000;
        const progress = Math.min(1, elapsed / duration);
        graphic.alpha = Math.max(0, 1 - progress);
        graphic.scale.set(1 + progress * (backgroundEffect === "starburst" ? .75 : .35));
        graphic.pivot.set(point.x, point.y);
        graphic.position.set(point.x, point.y);
        if (progress >= 1) { runtime.app.ticker.remove(tick); graphic.destroy(); }
      };
      runtime.app.ticker.add(tick);
    }
    return duration;
  }, []);

  const playBattleEffect = useCallback((effect: BattleEffectName, options?: VfxOptions) => play(BATTLE_VFX[effect], options), [play]);
  const playPackEffect = useCallback((effect: PackEffectName, options?: VfxOptions) => play(PACK_VFX[effect], options), [play]);
  const emitAudioHook = useCallback((event: string) => window.dispatchEvent(new CustomEvent("mini-mystics:audio", { detail: { event } })), []);
  const value = useMemo(() => ({ playBattleEffect, playPackEffect, emitAudioHook }), [playBattleEffect, playPackEffect, emitAudioHook]);

  return <VfxContext.Provider value={value}><div className={`vfx-scope vfx-scope-${scope}`}><div className="vfx-content">{children}</div><div ref={hostRef} className="vfx-layer" /></div></VfxContext.Provider>;
}

export function useVFX() { return useContext(VfxContext); }
