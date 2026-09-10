"use client";

import Link from "next/link";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Coins, Gift, LockKeyhole, PackageOpen, Sparkles, Timer, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGame } from "./game-provider";
import { challengeForDate, dailyPackAvailableAt, isDailyPackAvailable, nextUtcDay, progressionConfig, utcDateKey } from "@/lib/progression/state";
import type { ChallengeProgress } from "@/lib/progression/state";
import type { SeasonReward } from "@/lib/progression/config";
import { definitionFor } from "@/lib/client-state";
import { optimizedAsset } from "@/lib/asset-url";
import { PACK_ART, REWARD_ART } from "@/lib/art";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  return now;
}
function countdown(target: Date, now: Date) {
  const minutes = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function currentChallengeProgress(state: ReturnType<typeof useGame>["state"], now: Date): ChallengeProgress {
  const challenge = challengeForDate(now, progressionConfig(state).challenges); const key = utcDateKey(now);
  return state.progression.dailyChallenges[key] ?? { challengeId: challenge.id, challengeDate: key, values: {}, sets: {}, battleValues: {}, completed: false, rewardClaimed: false };
}
function seasonRewardArt(reward: SeasonReward) {
  if (reward.artworkVariant) return optimizedAsset(reward.artworkVariant);
  if (reward.definitionId) return definitionFor(reward.definitionId)?.image ?? "/cards/Mystics/back.png";
  if (reward.type === "coins") return REWARD_ART.coins;
  if (reward.type === "xpBoost") return REWARD_ART.xpBoost;
  if (reward.type === "coinBoost") return REWARD_ART.coinBoost;
  if (reward.type === "standardPack") return PACK_ART.standard;
  return "/cards/Mystics/back.png";
}
function seasonRewardAmount(reward: SeasonReward) {
  if (reward.type === "coins") return `+${(reward.amount ?? 0).toLocaleString()}`;
  if (reward.type === "xpBoost") return "2× XP";
  if (reward.type === "coinBoost") return "2× COINS";
  if (reward.type === "standardPack") return "1 PACK";
  return null;
}

export function DailyPackCard({ compact = false }: { compact?: boolean }) {
  const { state, claimDailyPack } = useGame(); const now = useClock(); const last = state.progression.lastDailyPackClaimAt;
  const available = isDailyPackAvailable(last, now); const next = dailyPackAvailableAt(last);
  return <section className={`retention-card daily-pack-card ${available ? "ready" : ""} ${compact ? "compact" : ""}`}>
    <span className="retention-icon"><PackageOpen /></span><div><small>DAILY PACK</small><h2>{available ? "Ready" : "Next Pack"}</h2>
    <p>{available ? "A free Standard Pack is waiting." : next ? countdown(next, now) : "Ready now"}</p></div>
    {available ? <button className="button primary" onClick={() => void claimDailyPack().catch(() => undefined)}>Open now</button> : <span className="retention-timer"><Timer />{next ? countdown(next, now) : "Ready"}</span>}
  </section>;
}

export function DailyChallengeCard({ detailed = false }: { detailed?: boolean }) {
  const { state, claimDailyChallenge } = useGame(); const now = useClock(); const challenge = challengeForDate(now, progressionConfig(state).challenges); const progress = currentChallengeProgress(state, now);
  return <section className={`retention-card daily-challenge-card ${progress.completed ? "complete" : ""} ${detailed ? "detailed" : ""}`}>
    <span className="retention-icon"><CalendarCheck /></span><div className="retention-main"><small>{progress.completed ? "DAILY CHALLENGE COMPLETE" : `DAILY CHALLENGE · DAY ${challenge.day}`}</small><h2>{challenge.name}</h2><p>{challenge.description}</p>
      <div className="challenge-requirements">{challenge.requirements.map(requirement => { const value = Math.min(requirement.target, progress.values[requirement.metric] ?? 0); return <div key={requirement.metric}><span><b>{value.toLocaleString()}</b> / {requirement.target.toLocaleString()} {requirement.metric === "distinctOrders" ? "Orders" : ""}</span><div className="progress"><i style={{ width: `${value / requirement.target * 100}%` }} /></div></div>; })}</div>
      <p className="reward-copy"><Coins />{challenge.coins} Coins <Sparkles />{challenge.seasonXp} Season XP</p>
      <p className="next-copy"><Timer />Next Challenge: {countdown(nextUtcDay(now), now)}</p>
    </div>
    {progress.completed && !progress.rewardClaimed ? <button className="button primary" onClick={() => void claimDailyChallenge().catch(() => undefined)}>Claim reward</button> : progress.rewardClaimed ? <span className="claimed-label"><Check />Claimed</span> : <Link className="button ghost" href="/battle">Battle</Link>}
  </section>;
}

export function SeasonSummary() {
  const { state } = useGame(); const now = useClock(); const config = progressionConfig(state); const progress = state.progression.seasons[config.season.id] ?? { seasonXp: 0, currentTier: 1, claimedTiers: [] };
  const nextTier = Math.min(config.season.rewards.length, progress.currentTier + 1); const nextXp = config.season.thresholds[nextTier - 1]; const remaining = Math.max(0, Math.ceil((Date.parse(config.season.endsAt) - now.getTime()) / 86_400_000));
  return <section className="retention-card season-summary"><span className="retention-icon"><Trophy /></span><div className="retention-main"><small>SEASON PASS</small><h2>Tier {progress.currentTier}</h2><p>{progress.seasonXp.toLocaleString()} / {nextXp.toLocaleString()} Season XP</p><div className="progress"><i style={{ width: `${progress.currentTier === config.season.rewards.length ? 100 : Math.max(0, (progress.seasonXp - config.season.thresholds[progress.currentTier - 1]) / (nextXp - config.season.thresholds[progress.currentTier - 1]) * 100)}%` }} /></div><p>Next: {config.season.rewards[nextTier - 1]?.label ?? "Season complete"} · {remaining} Days Remaining</p></div><Link className="button ghost" href="/season-pass">View track</Link></section>;
}

export function DailyChallengeView() {
  return <div className="page progression-page"><header className="page-head"><div><span className="eyebrow">DAILY ROTATION</span><h1>Daily Challenge</h1><p>One global challenge each day. The 30-day rotation repeats indefinitely.</p></div></header><DailyChallengeCard detailed /></div>;
}

export function SeasonPassView() {
  const { state, claimSeasonTier } = useGame(); const now = useClock(); const [claimingTier, setClaimingTier] = useState<number | null>(null); const trackRef = useRef<HTMLDivElement>(null); const config = progressionConfig(state); const progress = state.progression.seasons[config.season.id] ?? { seasonXp: 0, currentTier: 1, claimedTiers: [] };
  const nextTier = Math.min(config.season.rewards.length, progress.currentTier + 1); const remaining = Math.max(0, Math.ceil((Date.parse(config.season.endsAt) - now.getTime()) / 86_400_000));
  const scrollTrack = (direction: number) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth * 0.82, behavior: "smooth" });
  return <div className="page progression-page season-page"><section className="season-hero"><span className="eyebrow">SEASON {config.season.number}</span><h1>30-Day Season</h1><div className="season-hero-stats"><span><b>Tier {progress.currentTier}</b><small>Current tier</small></span><span><b>{progress.seasonXp.toLocaleString()} / {config.season.thresholds[nextTier - 1].toLocaleString()}</b><small>Season XP</small></span><span><b>{remaining} days</b><small>Remaining</small></span></div><div className="progress"><i style={{ width: `${progress.seasonXp / config.season.thresholds.at(-1)! * 100}%` }} /></div><p>Next Reward: {config.season.rewards[nextTier - 1]?.label ?? "Season complete"}</p><p className="season-xp-guide"><Sparkles /> Earn Season XP by completing a battle (+{config.season.xpSources.battleComplete}), winning a battle (+{config.season.xpSources.battleWin}), earning the first-battle-of-the-day bonus (+{config.season.xpSources.firstBattleOfDay}), and claiming Daily Challenge rewards.</p></section>
    <div className="season-track-shell"><button className="season-track-arrow" type="button" aria-label="Previous season tiers" title="Previous season tiers" onClick={() => scrollTrack(-1)}><ChevronLeft /></button><div className="season-track" ref={trackRef} role="list" aria-label="Season reward tiers">{config.season.rewards.map((reward, index) => {
      const tier = index + 1;
      const unlocked = progress.currentTier >= tier;
      const claimed = progress.claimedTiers.includes(tier);
      const placeholder = reward.type.endsWith("Placeholder");
      const milestone = tier % 10 === 0;
      const amount = seasonRewardAmount(reward);
      return <article role="listitem" key={tier} className={`season-tier ${unlocked ? "unlocked" : "locked"} ${claimed ? "claimed" : ""} ${milestone ? "milestone" : ""} ${tier === config.season.rewards.length ? "finale" : ""}`}>
        <img className="season-reward-art" src={seasonRewardArt(reward)} alt="" />
        <span className="season-tier-vignette" />
        <span className="tier-number">TIER {tier}</span>
        {amount ? <strong className="season-reward-amount">{amount}</strong> : null}
        <div className="season-tier-copy"><h3>{reward.label}</h3><small>{config.season.thresholds[index].toLocaleString()} XP</small></div>
        {claimed
          ? <span className="season-claimed-stamp"><Check />CLAIMED</span>
          : unlocked && !placeholder
            ? <button className="button small season-claim-button" disabled={claimingTier !== null} onClick={() => { setClaimingTier(tier); void claimSeasonTier(tier).catch(() => undefined).finally(() => setClaimingTier(current => current === tier ? null : current)); }}>Claim</button>
            : <span className="season-locked-stamp"><LockKeyhole />{placeholder ? "Coming soon" : "Locked"}</span>}
      </article>;
    })}</div><button className="season-track-arrow" type="button" aria-label="Next season tiers" title="Next season tiers" onClick={() => scrollTrack(1)}><ChevronRight /></button></div>
  </div>;
}

export function DailyPackModal() {
  const { state, claimDailyPack } = useGame(); const [dismissed, setDismissed] = useState(false); const [busy, setBusy] = useState(false);
  if (dismissed || !isDailyPackAvailable(state.progression.lastDailyPackClaimAt) || state.openings.some(opening => !opening.complete)) return null;
  return <div className="modal-backdrop daily-pack-backdrop"><section className="confirm-panel daily-pack-modal" role="dialog" aria-modal="true" aria-labelledby="daily-pack-title"><Gift /><span className="eyebrow">DAILY REWARD</span><h2 id="daily-pack-title">Your Daily Pack is ready</h2><p>A free Standard Pack is waiting for you.</p><button className="button primary" disabled={busy} onClick={() => { setBusy(true); void claimDailyPack().catch(() => setBusy(false)); }}>{busy ? "Opening…" : "Open Pack"}</button><button className="button ghost" onClick={() => setDismissed(true)}>Later</button></section></div>;
}

export function NotificationCenter() {
  const { state, dismissNotification } = useGame(); const [open, setOpen] = useState(false); const unread = state.progression.notifications.filter(item => !item.read);
  return <div className="notification-center"><button className="icon-button notifications" title="Notifications" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`} onClick={() => setOpen(value => !value)}><Gift />{unread.length ? <i>{unread.length}</i> : null}</button>{open ? <div className="notification-panel"><h3>Notifications</h3>{unread.length ? unread.map(item => <button key={item.id} onClick={() => dismissNotification(item.id)}><span>{item.message}</span><small>Mark read</small></button>) : <p>You’re all caught up.</p>}</div> : null}</div>;
}
