"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import {
  defaultSettings,
  readSettings,
  serializeSettings,
  SETTINGS_KEY,
  validateSettings,
  type GameSettings,
} from "@/lib/settings";
import { animationConfig } from "@/lib/animations/config";
import { audioManager } from "@/lib/audio/manager";
import { AUDIO_HOOKS, AVAILABLE_AUDIO, MUSIC } from "@/lib/audio/registry";
import { useGame } from "./game-provider";
type SettingsContextValue = {
  settings: GameSettings;
  config: ReturnType<typeof animationConfig>;
  ready: boolean;
  saveStatus: string;
  update: <G extends keyof GameSettings, K extends keyof GameSettings[G]>(
    group: G,
    key: K,
    value: GameSettings[G][K],
  ) => void;
  reset: () => void;
};
const SettingsContext = createContext<SettingsContextValue | null>(null);
const deviceDefaults = () =>
  defaultSettings(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
    matchMedia("(pointer: coarse)").matches,
  );
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const motionExplicit = useRef(false);
  const current = useRef(settings);
  const config = useMemo(() => animationConfig(settings), [settings]);
  const persist = useCallback((next: GameSettings) => {
    current.current = next;
    setSettings(next);
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        serializeSettings(next, motionExplicit.current),
      );
      setSaveStatus("Settings saved");
    } catch {
      setSaveStatus("Applied for this session. Device storage is unavailable.");
    }
  }, []);
  useEffect(() => {
    const defaults = deviceDefaults();
    try {
      const saved = readSettings(localStorage.getItem(SETTINGS_KEY), defaults);
      motionExplicit.current = saved.motionExplicit;
      if (!saved.motionExplicit)
        saved.settings.visual.reducedMotion = defaults.visual.reducedMotion;
      current.current = saved.settings;
      setSettings(saved.settings);
    } catch {
      current.current = defaults;
      setSettings(defaults);
    }
    setReady(true);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (!motionExplicit.current)
        persist({
          ...current.current,
          visual: { ...current.current.visual, reducedMotion: media.matches },
        });
    };
    const sync = (event: StorageEvent) => {
      if (event.key !== SETTINGS_KEY) return;
      const saved = readSettings(event.newValue, deviceDefaults());
      motionExplicit.current = saved.motionExplicit;
      if (!saved.motionExplicit)
        saved.settings.visual.reducedMotion = media.matches;
      current.current = saved.settings;
      setSettings(saved.settings);
    };
    media.addEventListener("change", change);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", change);
      window.removeEventListener("storage", sync);
    };
  }, [persist]);
  const update: SettingsContextValue["update"] = useCallback(
    (group, key, value) => {
      if (group === "visual" && key === "reducedMotion")
        motionExplicit.current = true;
      persist(
        validateSettings({
          ...current.current,
          [group]: { ...current.current[group], [key]: value },
        }),
      );
    },
    [persist],
  );
  const reset = useCallback(() => {
    motionExplicit.current = false;
    persist(deviceDefaults());
  }, [persist]);
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const values = {
      reducedMotion: settings.visual.reducedMotion,
      screenShake: config.shake,
      flash: config.flash,
      hoverEffects: settings.visual.cardHoverEffects,
      highContrast: settings.accessibility.highContrast,
      largerText: settings.accessibility.largerText,
      colorblind: settings.accessibility.colorblindMode,
      compactBattle: settings.interface.compactBattleUI,
      battleStats: settings.interface.showBattleStats,
      tutorialTips: settings.interface.tutorialTips,
      animationMode: settings.gameplay.animationMode,
      effectsQuality: settings.visual.effectsQuality,
    };
    for (const [key, value] of Object.entries(values))
      root.dataset[key] = String(value);
    root.style.setProperty("--presentation-ui", `${config.ui}ms`);
    root.style.setProperty("--presentation-action", `${config.basic}ms`);
  }, [settings, config, ready]);
  useEffect(() => {
    if (settings.interface.tooltips) return;
    const titles = new Map<Element, string>();
    const strip = () =>
      document.querySelectorAll("[title]").forEach((node) => {
        titles.set(node, node.getAttribute("title")!);
        node.removeAttribute("title");
      });
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title"],
    });
    return () => {
      observer.disconnect();
      titles.forEach((title, node) => {
        if (node.isConnected && !node.hasAttribute("title"))
          node.setAttribute("title", title);
      });
    };
  }, [settings.interface.tooltips]);
  const value = useMemo(
    () => ({ settings, config, ready, update, reset, saveStatus }),
    [settings, config, ready, update, reset, saveStatus],
  );
  return (
    <SettingsContext.Provider value={value}>
      <MotionConfig
        reducedMotion={settings.visual.reducedMotion ? "always" : "never"}
        transition={{ duration: config.ui / 1000 }}
      >
        <AudioBridge />
        {children}
      </MotionConfig>
    </SettingsContext.Provider>
  );
}
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("SettingsProvider is required");
  return context;
}
function AudioBridge() {
  const { settings, ready } = useSettings();
  const { state } = useGame();
  const pathname = usePathname();
  useEffect(() => {
    audioManager.configure(settings.audio);
  }, [settings.audio]);
  useEffect(() => {
    if (!ready) return;
    const onBattle = pathname === "/battle" && !!state.battle;
    if (onBattle && state.battle?.winner) audioManager.stopMusic();
    else audioManager.playMusic(onBattle ? "battle" : "menu");
  }, [pathname, state.battle?.id, state.battle?.winner, ready]);
  useEffect(() => {
    const result = (event: Event) => {
      if (pathname !== "/battle") return;
      const name =
        (event as CustomEvent<{ winner: string }>).detail.winner === "player"
          ? "victory"
          : "defeat";
      if (AVAILABLE_AUDIO.has(MUSIC[name])) audioManager.playMusic(name);
      else audioManager.playSFX(name);
    };
    window.addEventListener("mini-mystics:battle-result", result);
    return () =>
      window.removeEventListener("mini-mystics:battle-result", result);
  }, [pathname]);
  useEffect(() => {
    const unlock = () => audioManager.unlock();
    const click = (event: MouseEvent) => {
      if (
        (event.target as Element)?.closest?.(
          "button:not(:disabled), a, select, input",
        )
      )
        audioManager.playSFX("ui-click");
    };
    const hook = (event: Event) => {
      const name =
        AUDIO_HOOKS[(event as CustomEvent<{ event: string }>).detail?.event];
      if (name) audioManager.playSFX(name);
    };
    const visibility = () => {
      if (document.hidden) audioManager.pauseMusic();
      else audioManager.resumeMusic();
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("click", click);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("mini-mystics:audio", hook);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("click", click);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("mini-mystics:audio", hook);
      audioManager.dispose();
    };
  }, []);
  return null;
}
