import type { GameSettings } from "../settings";
import { defaultSettings } from "../settings";
import {
  AVAILABLE_AUDIO,
  MUSIC,
  SFX,
  type MusicName,
  type SfxName,
} from "./registry";
type Voice = { audio: HTMLAudioElement; priority: number; gain: number };
export class AudioManager {
  private settings = defaultSettings().audio;
  private unlocked = false;
  private muted = false;
  private paused = false;
  private music: {
    name: MusicName;
    audio: HTMLAudioElement;
    gain: number;
  } | null = null;
  private desired: MusicName | null = null;
  private voices = new Set<Voice>();
  private failed = new Set<string>();
  private last = new Map<string, number>();
  private fade: ReturnType<typeof setInterval> | undefined;
  private retiring: HTMLAudioElement | null = null;
  constructor(
    private available = AVAILABLE_AUDIO,
    private createAudio = (path: string) => new Audio(path),
  ) {}
  configure(settings: GameSettings["audio"]) {
    this.settings = settings;
    this.updateVolumes();
    for (const voice of this.voices)
      if (
        !settings.sfxEnabled ||
        (!settings.uiSoundsEnabled && voice.priority === 0)
      ) {
        voice.audio.pause();
        this.voices.delete(voice);
      }
    this.syncMusic();
  }
  private volume(kind: "music" | "sfx") {
    return this.muted
      ? 0
      : ((this.settings.masterVolume / 100) *
          this.settings[kind === "music" ? "musicVolume" : "sfxVolume"]) /
          100;
  }
  private updateVolumes() {
    if (this.music)
      this.music.audio.volume = this.volume("music") * this.music.gain;
    for (const voice of this.voices)
      voice.audio.volume = this.volume("sfx") * voice.gain;
  }
  private play(audio: HTMLAudioElement, path: string) {
    audio.onerror = () => {
      this.failed.add(path);
      audio.pause();
      for (const voice of this.voices)
        if (voice.audio === audio) this.voices.delete(voice);
    };
    try {
      void audio.play().catch((error: { name?: string }) => {
        if (error?.name === "NotAllowedError") {
          this.unlocked = false;
          if (this.music?.audio === audio) this.clearMusic();
        } else if (error?.name !== "AbortError") this.failed.add(path);
        for (const voice of this.voices)
          if (voice.audio === audio) this.voices.delete(voice);
      });
    } catch {
      this.failed.add(path);
    }
  }
  unlock() {
    this.unlocked = true;
    this.syncMusic();
  }
  playSFX(name: SfxName) {
    const path = SFX[name];
    const ui = name.startsWith("ui-");
    if (
      !this.unlocked ||
      this.muted ||
      !this.settings.sfxEnabled ||
      (ui && !this.settings.uiSoundsEnabled) ||
      !this.available.has(path) ||
      this.failed.has(path)
    )
      return;
    const now = Date.now();
    if (
      now - (this.last.get(name) ?? -Infinity) <
      (ui ? 90 : 70)
    )
      return;
    this.last.set(name, now);
    const priority = ui
      ? 0
      : /victory|defeat|apex/.test(name)
        ? 3
        : /special/.test(name)
          ? 2
          : 1;
    if ([...this.voices].some((voice) => voice.priority > priority)) return;
    for (const voice of this.voices)
      if (voice.priority < priority || this.voices.size >= 6) {
        voice.audio.pause();
        this.voices.delete(voice);
      }
    const audio = this.createAudio(path);
    const voice = { audio, priority, gain: ui ? 0.45 : 1 };
    this.voices.add(voice);
    audio.onended = () => this.voices.delete(voice);
    this.updateVolumes();
    this.play(audio, path);
  }
  playMusic(name: MusicName) {
    this.desired = name;
    this.paused = false;
    this.syncMusic();
  }
  private syncMusic() {
    const name = this.desired;
    if (
      !name ||
      !this.unlocked ||
      this.paused ||
      this.muted ||
      !this.settings.musicEnabled ||
      (name === "battle" && !this.settings.battleMusicEnabled)
    ) {
      this.clearMusic();
      return;
    }
    if (this.music?.name === name) return;
    const path = MUSIC[name];
    const previous = this.music?.audio;
    this.clearFade();
    this.music = null;
    if (!this.available.has(path) || this.failed.has(path)) {
      previous?.pause();
      return;
    }
    const audio = this.createAudio(path);
    audio.loop = name === "menu" || name === "battle";
    this.music = { name, audio, gain: 0 };
    audio.volume = 0;
    this.play(audio, path);
    this.retiring = previous ?? null;
    // Result stingers should not compete with battle music.
    if (name === "victory" || name === "defeat") {
      previous?.pause();
      this.retiring = null;
      this.stopSFX();
    }
    let elapsed = 0;
    this.fade = setInterval(() => {
      elapsed += 40;
      const progress = Math.min(1, elapsed / 400);
      if (this.music) this.music.gain = progress;
      if (this.retiring)
        this.retiring.volume = this.volume("music") * (1 - progress);
      this.updateVolumes();
      if (progress === 1) this.clearFade();
    }, 40);
  }
  private clearFade() {
    clearInterval(this.fade);
    this.fade = undefined;
    this.retiring?.pause();
    this.retiring = null;
  }
  private clearMusic() {
    this.clearFade();
    this.music?.audio.pause();
    this.music = null;
  }
  stopMusic() {
    this.desired = null;
    this.clearMusic();
  }
  pauseMusic() {
    this.paused = true;
    this.music?.audio.pause();
    this.clearFade();
  }
  resumeMusic() {
    this.paused = false;
    if (this.music) {
      this.music.gain = 1;
      this.updateVolumes();
      this.play(this.music.audio, MUSIC[this.music.name]);
    } else this.syncMusic();
  }
  setMasterVolume(value: number) {
    this.configure({
      ...this.settings,
      masterVolume: Math.max(0, Math.min(100, value)),
    });
  }
  setMusicVolume(value: number) {
    this.configure({
      ...this.settings,
      musicVolume: Math.max(0, Math.min(100, value)),
    });
  }
  setSFXVolume(value: number) {
    this.configure({
      ...this.settings,
      sfxVolume: Math.max(0, Math.min(100, value)),
    });
  }
  mute() {
    this.muted = true;
    this.updateVolumes();
    this.syncMusic();
  }
  unmute() {
    this.muted = false;
    this.updateVolumes();
    this.syncMusic();
  }
  private stopSFX() {
    for (const voice of this.voices) voice.audio.pause();
    this.voices.clear();
  }
  dispose() {
    this.stopMusic();
    this.stopSFX();
    this.unlocked = false;
  }
}
export const audioManager = new AudioManager();
