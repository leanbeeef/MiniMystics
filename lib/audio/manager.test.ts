import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "./manager";
import { MUSIC, SFX } from "./registry";
import { defaultSettings } from "../settings";
const setup = () => {
  const voices: {
    path: string;
    volume: number;
    loop: boolean;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    onerror?: () => void;
    onended?: () => void;
  }[] = [];
  const factory = (path: string) => {
    const voice = {
      path,
      volume: 1,
      loop: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    };
    voices.push(voice);
    return voice as unknown as HTMLAudioElement;
  };
  const manager = new AudioManager(
    new Set([...Object.values(MUSIC), ...Object.values(SFX)]),
    factory,
  );
  return { manager, voices };
};
afterEach(() => vi.useRealTimers());
describe("central audio manager", () => {
  it("waits for interaction, loops music and multiplies master/music volume", () => {
    vi.useFakeTimers();
    const { manager, voices } = setup();
    manager.configure({
      ...defaultSettings().audio,
      masterVolume: 50,
      musicVolume: 40,
    });
    manager.playMusic("menu");
    expect(voices).toHaveLength(0);
    manager.unlock();
    vi.advanceTimersByTime(500);
    expect(voices[0]).toMatchObject({ loop: true, volume: 0.2 });
    manager.setMasterVolume(100);
    expect(voices[0].volume).toBe(0.4);
    manager.setMusicVolume(30);
    expect(voices[0].volume).toBe(0.3);
    manager.dispose();
  });
  it("controls SFX/UI independently and throttles repeated sounds", () => {
    const { manager, voices } = setup();
    manager.unlock();
    manager.configure({
      ...defaultSettings().audio,
      masterVolume: 50,
      sfxVolume: 60,
      uiSoundsEnabled: false,
    });
    manager.playSFX("ui-click");
    expect(voices).toHaveLength(0);
    manager.playSFX("attack-hit");
    expect(voices[0].volume).toBe(0.3);
    manager.playSFX("attack-hit");
    expect(voices).toHaveLength(1);
    manager.setSFXVolume(20);
    expect(voices[0].volume).toBe(0.1);
    manager.configure({ ...defaultSettings().audio, sfxEnabled: false });
    expect(voices[0].pause).toHaveBeenCalled();
    manager.playSFX("heal");
    expect(voices).toHaveLength(1);
    manager.dispose();
  });
  it("stops battle music for results and honors music/battle toggles", () => {
    vi.useFakeTimers();
    const { manager, voices } = setup();
    manager.unlock();
    manager.playMusic("battle");
    vi.advanceTimersByTime(500);
    manager.playMusic("victory");
    expect(voices[0].pause).toHaveBeenCalled();
    expect(voices[1].loop).toBe(false);
    manager.configure({ ...defaultSettings().audio, musicEnabled: false });
    expect(voices[1].pause).toHaveBeenCalled();
    manager.configure({
      ...defaultSettings().audio,
      battleMusicEnabled: false,
    });
    manager.playMusic("battle");
    expect(voices.at(-1)?.path).not.toBe(MUSIC.battle);
    manager.dispose();
  });
  it("silently skips missing asset slots and remembers loading failures", () => {
    const factory = vi.fn();
    const empty = new AudioManager(new Set(), factory);
    empty.unlock();
    empty.playMusic("menu");
    empty.playSFX("attack-hit");
    expect(factory).not.toHaveBeenCalled();
    const { manager, voices } = setup();
    manager.unlock();
    manager.playSFX("heal");
    voices[0].onerror?.();
    manager.playSFX("heal");
    expect(voices).toHaveLength(1);
    manager.dispose();
  });
  it("lets major sounds dominate hover and disposes active audio", () => {
    const { manager, voices } = setup();
    manager.unlock();
    manager.playSFX("special-charge");
    expect(voices).toHaveLength(1);
    manager.dispose();
    expect(voices[0].pause).toHaveBeenCalled();
  });
  it("recovers from autoplay rejection after another interaction", async () => {
    vi.useFakeTimers();
    const voices: HTMLAudioElement[] = [];
    const factory = () => {
      const audio = {
        play: voices.length
          ? vi.fn().mockResolvedValue(undefined)
          : vi.fn().mockRejectedValue({ name: "NotAllowedError" }),
        pause: vi.fn(),
        volume: 1,
      } as unknown as HTMLAudioElement;
      voices.push(audio);
      return audio;
    };
    const manager = new AudioManager(new Set([MUSIC.menu]), factory);
    manager.playMusic("menu");
    manager.unlock();
    await Promise.resolve();
    expect(voices).toHaveLength(1);
    manager.unlock();
    vi.advanceTimersByTime(500);
    expect(voices).toHaveLength(2);
    expect(voices[1].play).toHaveBeenCalled();
    manager.dispose();
  });
  it("resumes at the configured volume when hidden during a crossfade", () => {
    vi.useFakeTimers();
    const { manager, voices } = setup();
    manager.unlock();
    manager.playMusic("menu");
    vi.advanceTimersByTime(80);
    manager.pauseMusic();
    manager.resumeMusic();
    expect(voices[0].volume).toBeCloseTo(0.8 * 0.45);
    manager.dispose();
  });
});
