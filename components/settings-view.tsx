"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Swords, Volume2 } from "lucide-react";
import { useSettings } from "./settings-provider";
import type { GameSettings } from "@/lib/settings";
import { audioManager } from "@/lib/audio/manager";
import { AVAILABLE_AUDIO } from "@/lib/audio/registry";
import { ORDER_COLORS } from "@/lib/art";

type Control = { group: keyof GameSettings; key: string; label: string; description: string; options?: string[]; disabled?: boolean };
const sections: { title: string; controls: Control[] }[] = [
  { title: "Gameplay", controls: [
    { group: "gameplay", key: "animationMode", label: "Battle Animation", description: "Choose quick feedback or a full Special presentation.", options: ["minimal", "standard", "cinematic"] },
    { group: "gameplay", key: "autoAdvance", label: "Auto Advance Battle", description: "Continue to the opponent automatically after effects finish. Never chooses your actions." },
    { group: "gameplay", key: "confirmEndTurn", label: "Confirm End Turn", description: "Unavailable: turns currently end when an action resolves; there is no manual End Turn.", disabled: true },
    { group: "gameplay", key: "showDamageDetails", label: "Show Damage Details", description: "Show the existing damage preview and contributing bonuses in the action deck." },
  ] },
  { title: "Audio", controls: [
    ...["master", "music", "sfx"].map((kind) => ({ group: "audio" as const, key: `${kind}Volume`, label: kind === "sfx" ? "Sound Effects Volume" : `${kind === "master" ? "Master" : "Music"} Volume`, description: kind === "master" ? "Overall audio level." : `Adjust ${kind === "sfx" ? "sound effects" : "music"} independently.` })),
    ...[["musicEnabled", "Music", "Loop music in menus and the arena."], ["sfxEnabled", "Sound Effects", "Battle, pack, and interface sound effects."], ["uiSoundsEnabled", "UI Sounds", "Interface clicks and hover sounds; battle sounds stay enabled."], ["battleMusicEnabled", "Music During Battle", "Play the battle theme during active matches."]].map(([key, label, description]) => ({ group: "audio" as const, key, label, description })),
  ] },
  { title: "Visual", controls: [
    { group: "visual", key: "screenShake", label: "Screen Shake", description: "Small arena movement on heavy impacts. Reduced Motion overrides this." },
    { group: "visual", key: "particleEffects", label: "Particle Effects", description: "Control particles in battles and pack reveals.", options: ["off", "reduced", "full"] },
    { group: "visual", key: "effectsQuality", label: "Battle Effects Quality", description: "Adjust particle count, simultaneous effects, and arena ambience.", options: ["low", "medium", "high"] },
    { group: "visual", key: "floatingCombatText", label: "Floating Combat Text", description: "Numbers and status labels near affected Mystics. The battle log stays available." },
    { group: "visual", key: "cardHoverEffects", label: "Card Hover Effects", description: "Lift cards on devices that support hovering." },
  ] },
  { title: "Interface", controls: [
    { group: "gameplay", key: "battleSpeed", label: "Battle Speed", description: "Delay between automated transitions, independent of animation intensity.", options: ["fast", "normal", "deliberate"] },
    ...[["tooltips", "Tooltips", "Show additional information on hover."], ["tutorialTips", "Tutorial Tips", "Show contextual instructions beneath the battlefield."], ["compactBattleUI", "Compact Battle UI", "Reduce spacing and Handler artwork for smaller screens."], ["showBattleStats", "Show Card Stats During Battle", "Show ATK and DEF beneath cards. Power remains visible."]].map(([key, label, description]) => ({ group: "interface" as const, key, label, description })),
  ] },
  { title: "Accessibility", controls: [
    { group: "visual", key: "reducedMotion", label: "Reduced Motion", description: "Replace large movement with short fades, disable shake and ambient particles. Follows your device until you change it." },
    { group: "accessibility", key: "highContrast", label: "High Contrast UI", description: "Stronger text, borders, and controls. Card artwork is unchanged." },
    { group: "accessibility", key: "largerText", label: "Larger Interface Text", description: "Increase interface text while retaining card artwork." },
    { group: "accessibility", key: "disableFlashEffects", label: "Disable Flash Effects", description: "Replace impact flashes with stable outlines and fades." },
    { group: "accessibility", key: "colorblindMode", label: "Colorblind Support", description: "Distinct UI colors plus text, icons, and patterned status outlines.", options: ["off", "protanopia", "deuteranopia", "tritanopia"] },
  ] },
];
export function SettingsView() {
  const { settings, update, ready, saveStatus, reset, config } = useSettings();
  const [preview, setPreview] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const wasConfirm = useRef(false);
  useEffect(() => { if (confirm) cancelRef.current?.focus(); else if (wasConfirm.current) resetRef.current?.focus({ preventScroll: true }); wasConfirm.current = confirm; }, [confirm]);
  return <div className="page settings-page"><header className="page-head"><div><span className="eyebrow">SYSTEM</span><h1>Settings</h1><p>Make the Convergence your own. Preferences save automatically on this device.</p></div><span role="status" className="settings-saved">{saveStatus}</span></header>
    <section className="panel settings-preview"><div><Sparkles /><h2>Feel the difference</h2><p>{settings.gameplay.animationMode} · {config.reduced ? "Reduced motion" : `${config.special} ms Special`}</p><button className="button ghost" onClick={() => { setPreview((value) => value + 1); audioManager.playSFX("attack-hit"); }}>Preview impact</button></div><motion.div key={`${preview}-${JSON.stringify(settings.visual)}-${settings.gameplay.animationMode}`} className="settings-preview-stage" animate={{ x: preview && config.shake ? [0, -3, 3, 0] : 0 }} transition={{ duration: config.special / 1000 }}><motion.div className="settings-preview-card" style={{ borderColor: ORDER_COLORS["First Spark"] }} animate={{ y: config.reduced ? 0 : [0, -config.distance, 0], scale: config.cinematic ? [1, 1.14, 1] : 1, opacity: [.6, 1] }} transition={{ duration: config.special / 1000 }}><Swords /><strong>First Spark</strong><span>Special Move</span></motion.div>{config.particles > 0 ? Array.from({ length: Math.ceil(10 * config.particles) }, (_, index) => <motion.i className="preview-particle" key={index} style={{ background: ORDER_COLORS["First Spark"] }} animate={{ x: [0, Math.cos(index * 2.4) * 85], y: [0, Math.sin(index * 2.4) * 65], opacity: [0, 1, 0] }} transition={{ duration: config.special / 1000 }} />) : null}{config.floatingText ? <motion.b className="preview-number" animate={{ opacity: [0, 1, 0], y: config.reduced ? 0 : [0, -25] }} transition={{ duration: config.special / 1000 }}>−24</motion.b> : null}<span className="sr-only">Illustrative damage preview; no game action is performed.</span></motion.div></section>
    <div className="settings-grid">{sections.map((section) => <section key={section.title} className="panel preference-section"><h2>{section.title}</h2>{section.title === "Audio" && AVAILABLE_AUDIO.size === 0 ? <p className="settings-note"><Volume2 />Audio is ready for music and sound files. This build is currently silent.</p> : null}{section.controls.map((control) => {
      const id = `setting-${control.group}-${control.key}`;
      const value = (settings[control.group] as Record<string, unknown>)[control.key];
      const change = (next: unknown) => update(control.group, control.key as never, next as never);
      return <div className="preference-row" key={id}><div><label htmlFor={id}>{control.label}</label><p id={`${id}-help`}>{control.description}</p></div>{control.options ? <select id={id} aria-describedby={`${id}-help`} disabled={!ready} value={String(value)} onChange={(event) => change(event.target.value)}>{control.options.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select> : typeof value === "number" ? <div className="preference-volume"><input id={id} aria-describedby={`${id}-help`} type="range" min="0" max="100" disabled={!ready} value={value} onChange={(event) => change(Number(event.target.value))} /><output htmlFor={id}>{value}%</output></div> : <input className="preference-toggle" type="checkbox" role="switch" id={id} aria-describedby={`${id}-help`} disabled={!ready || control.disabled} checked={Boolean(value)} onChange={(event) => change(event.target.checked)} />}</div>;
    })}</section>)}</div>
    <button ref={resetRef} className="button ghost settings-reset" disabled={!ready} onClick={() => setConfirm(true)}>Reset to Defaults</button>
    {confirm ? <div className="modal-backdrop confirm-backdrop" onKeyDown={(event) => { if (event.key === "Escape") setConfirm(false); if (event.key === "Tab") { const buttons = event.currentTarget.querySelectorAll("button"); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}><section className="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="settings-reset-title"><h2 id="settings-reset-title">Reset settings?</h2><p>Restore all presentation preferences on this device. Reduced Motion will follow your device again.</p><div className="confirm-actions"><button ref={cancelRef} className="button ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="button primary" onClick={() => { reset(); setConfirm(false); }}>Reset to Defaults</button></div></section></div> : null}
  </div>;
}
