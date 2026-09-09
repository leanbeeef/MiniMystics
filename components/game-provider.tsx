"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { activateBoost as activateBoostRule, buyPack as buyPackRule, createAccount, createBattle, dismantleCard as dismantleCardRule, initialState, levelUpCard as levelUpCardRule, ORDER_CAMPAIGNS, rewardCompletedBattle, sellDuplicateCard as sellDuplicateCardRule, setActiveLoadout as setActiveLoadoutRule, type BattleSelection, type Binder, type Loadout, type PlayerState } from "@/lib/client-state";
import { findStage } from "@/lib/game/campaigns";
import { performBasicAttack, performSpecial, previewDamage } from "@/lib/game/engine";
import { orderAdvantagePercent } from "@/lib/game/order-matchups";
import { getSupabaseClient } from "@/lib/supabase";
import { ensurePlayerProfile, getPlayerProfile, savePlayerProfile, validateHandlerName, type ProfileInput } from "@/lib/player-profile";
import { loadCloudGameState, queueCloudGameState, type GameActivityType } from "@/lib/game-sync-client";
import { selectHydratedGameState } from "@/lib/game-state-merge";
import { claimDailyChallengeFromServer, claimDailyPackFromServer, claimSeasonTierFromServer } from "@/lib/progression-client";
import { applyProgressEvent, dismissNotification as dismissNotificationRule, emptyProgression, ensureRetentionNotifications } from "@/lib/progression/state";

type Accounts = Record<string, { passwordHash?: string; state: PlayerState }>;
type GameContextValue = {
  state: PlayerState;
  ready: boolean;
  error: string | null;
  signup(email: string, username: string, password: string): Promise<boolean>;
  login(email: string, password: string): Promise<void>;
  loginWithGoogle(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  linkGoogle(): Promise<void>;
  updatePlayerProfile(profile: ProfileInput): Promise<void>;
  logout(): Promise<void>;
  saveComicProgress(volumeId: string, pageIndex: number, completed?: boolean): void;
  reveal(openingId: string, cardId?: string): void;
  buyPack(packId: string, order?: string): void;
  activateBoost(id: string): void;
  saveLoadout(loadout: Omit<Loadout, "id"> & { id?: string }): void;
  deleteLoadout(id: string): void;
  setActiveLoadout(id: string): void;
  createBinder(name: string): void;
  renameBinder(id: string, name: string): void;
  toggleBinderCard(binderId: string, ownedId: string): void;
  sellDuplicate(ownedId: string): void;
  dismantleCard(ownedId: string): void;
  levelUpCard(ownedId: string): void;
  startBattle(opponentId: string, selection?: BattleSelection): void;
  basicAttack(attackerId: string, defenderId: string): void;
  specialAttack(attackerId: string, defenderId: string, moveIndex: number, rolledFace?: number): void;
  aiTurn(): void;
  claimDailyPack(): Promise<void>;
  claimDailyChallenge(): Promise<void>;
  claimSeasonTier(tier: number): Promise<void>;
  dismissNotification(id: string): void;
};

const GameContext = createContext<GameContextValue | null>(null);
const ACCOUNTS_KEY = "mini-mystics.accounts.v1";
const CURRENT_KEY = "mini-mystics.current.v1";

function getAccounts(): Accounts {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "{}"); } catch { return {}; }
}

function authMessage(cause: unknown) {
  const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "";
  const messages: Record<string, string> = {
    "email_exists": "An account with that email already exists.",
    "user_already_exists": "An account with that email already exists.",
    "invalid_credentials": "Email or password is incorrect.",
    "email_address_invalid": "Enter a valid email address.",
    "auth/missing-config": "Supabase is not configured for this deployment.",
    "email_provider_disabled": "Email and password sign-in is not enabled yet.",
    "over_email_send_rate_limit": "Too many email attempts. Wait a moment and try again.",
    "over_request_rate_limit": "Too many attempts. Wait a moment and try again.",
    "user_banned": "This account has been disabled.",
    "weak_password": "Choose a password with at least 8 characters.",
    "email_not_confirmed": "Confirm your email before signing in.",
    "permission-denied": "You do not have permission to update this profile.",
    "failed-precondition": "Profile storage needs one more setup step.",
    "unavailable": "Cloud profile sync is temporarily unavailable. Your game is still saved on this device.",
  };
  if (messages[code]) return messages[code];
  if (cause instanceof Error && /client is offline|failed to get document/i.test(cause.message)) {
    return "Cloud profile sync is temporarily unavailable. Your game is still saved on this device.";
  }
  if (cause instanceof Error && cause.message) return cause.message;
  return "Could not authenticate with Supabase.";
}

function isTemporaryProfileSyncFailure(cause: unknown) {
  const code = typeof cause === "object" && cause && "code" in cause ? String(cause.code) : "";
  const message = cause instanceof Error ? cause.message : "";
  return ["unavailable", "network_error", "profile/http-500", "profile/http-503"].includes(code)
    || /network|failed to fetch|temporarily unavailable/i.test(message);
}

/**
 * Backfills fields the current build requires that a saved blob may predate — applies to both
 * the local/localStorage copy and whatever comes back from the cloud, since a cloud save can be
 * arbitrarily old and is otherwise used as-is with no migration pass of its own.
 */
function migrateLegacyState(saved: PlayerState): boolean {
  let changed = false;
  if (!Number.isSafeInteger(saved.saveRevision) || saved.saveRevision < 0) { saved.saveRevision = 0; changed = true; }
  if (!Array.isArray(saved.campaignWins)) { saved.campaignWins = []; changed = true; }
  if (!saved.comicProgress || typeof saved.comicProgress !== "object") { saved.comicProgress = {}; changed = true; }
  if ((saved as Partial<PlayerState>).profile === undefined) { saved.profile = null; changed = true; }
  if (!saved.essence || typeof saved.essence !== "object") { saved.essence = {}; changed = true; }
  if (!saved.progression || typeof saved.progression !== "object") { saved.progression = emptyProgression(); changed = true; }
  saved.progression.dailyChallenges ??= {};
  saved.progression.seasons ??= {};
  saved.progression.notifications ??= [];
  if (saved.progression.lastDailyPackClaimAt === undefined) { saved.progression.lastDailyPackClaimAt = null; changed = true; }
  if (ensureRetentionNotifications(saved)) changed = true;
  for (const owned of saved.ownedCards) if (typeof owned.level !== "number") { owned.level = 1; changed = true; }
  // A battle saved before the D8 rewrite is missing required fields (synergies, activeEffects,
  // handlerBonuses, ...) that the current engine/UI assume are always present. Rather than guess
  // at reconstructing it, drop it — battles were never resumable across a deploy regardless.
  if (saved.battle && !(saved.battle.player as { synergies?: unknown } | undefined)?.synergies) {
    saved.battle = null;
    saved.battleRewarded = false;
    saved.lastRewards = null;
    changed = true;
  }
  return changed;
}

function restoreProfile(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return initialState;
  const accounts = getAccounts();
  let saved = accounts[email]?.state;
  let changed = false;
  if (!saved) {
    const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name;
    const fallbackName = (typeof metadataName === "string" ? metadataName.trim() : "") || email.split("@")[0] || "Handler";
    saved = createAccount(email, fallbackName);
    changed = true;
  }
  if (migrateLegacyState(saved)) changed = true;
  if (changed || !accounts[email]) {
    accounts[email] = { ...accounts[email], state: saved };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
  localStorage.setItem(CURRENT_KEY, email);
  return saved;
}

function saveLocalState(state: PlayerState) {
  const email = state.account?.email;
  if (!email) return;
  const accounts = getAccounts();
  accounts[email] = { ...accounts[email], state };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>(initialState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<PlayerState>(initialState);
  const localRevision = useRef(0);
  const router = useRouter();
  const replaceState = useCallback((next: PlayerState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    try {
      let active = true;
      let sequence = 0;
      let hydratedUserId: string | null | undefined;
      const hydrate = async (user: User | null, currentSequence: number) => {
        if (user) {
          const startingRevision = localRevision.current;
          const restored = restoreProfile(user);
          replaceState(structuredClone(restored));
          // The local save renders immediately while the PostgreSQL-backed API hydrates durable state.
          setReady(true);
          let cloudState: PlayerState | null = null;
          try { cloudState = await loadCloudGameState(); } catch { /* The local save remains available while the API recovers. */ }
          const cloudNeededMigration = Boolean(cloudState) && migrateLegacyState(cloudState!);
          const selection = selectHydratedGameState(restored, cloudState);
          const hydrated = selection.state;
          hydrated.account = restored.account;
          try {
            const profile = await getPlayerProfile(user.id)
              ?? await ensurePlayerProfile(user, hydrated.account?.username);
            hydrated.profile = profile;
            if (profile) hydrated.account = { email: hydrated.account!.email, username: profile.handlerName };
            setError(null);
          } catch (cause) {
            setError(isTemporaryProfileSyncFailure(cause) ? null : authMessage(cause));
          }
          if (!active || currentSequence !== sequence || localRevision.current !== startingRevision) return;
          saveLocalState(hydrated);
          replaceState(structuredClone(hydrated));
          if (selection.cloudNeedsUpdate || cloudNeededMigration) {
            void queueCloudGameState(hydrated, "SESSION_STARTED").catch((cause) => {
              if (active && currentSequence === sequence) setError(cause instanceof Error ? cause.message : "Could not save game progress.");
            });
          }
        } else { localStorage.removeItem(CURRENT_KEY); replaceState(initialState); setReady(true); }
      };
      const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
        const userId = session?.user.id ?? null;
        // Supabase also emits auth events when it refreshes a token or re-confirms the same
        // session. Rehydrating for those events can replace newer optimistic game state with a
        // cloud snapshot that is still waiting in the save queue.
        if (userId === hydratedUserId) return;
        hydratedUserId = userId;
        const currentSequence = ++sequence;
        window.setTimeout(() => { if (active) void hydrate(session?.user ?? null, currentSequence); }, 0);
      });
      return () => { active = false; subscription.unsubscribe(); };
    } catch (cause) {
      setError(authMessage(cause));
      setReady(true);
    }
  }, [replaceState]);

  const commit = useCallback((mutator: (draft: PlayerState) => void, activity: GameActivityType, payload?: Record<string, unknown>) => {
    const current = stateRef.current;
    const draft = structuredClone(current);
    try { mutator(draft); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong"); return; }
    draft.saveRevision = Math.max(current.saveRevision ?? 0, draft.saveRevision ?? 0) + 1;
    localRevision.current += 1;
    replaceState(draft);
    if (draft.account?.email) {
      saveLocalState(draft);
      void queueCloudGameState(draft, activity, payload).catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Could not save game progress.");
      });
    }
  }, [replaceState]);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    const handlerError = validateHandlerName(username);
    if (!normalized || handlerError || password.length < 8) throw new Error(handlerError ?? "Use a valid email and at least 8 password characters.");
    try {
      const { data, error: signupError } = await getSupabaseClient().auth.signUp({
        email: normalized,
        password,
        options: { data: { display_name: username.trim(), handler_name: username.trim() } },
      });
      if (signupError) throw signupError;
      if (!data.user) throw new Error("Supabase did not create the account.");
      if (!data.session) return false;
      const accounts = getAccounts();
      const next = accounts[normalized]?.state ?? createAccount(normalized, username.trim());
      next.account = { email: normalized, username: username.trim() };
      accounts[normalized] = { ...accounts[normalized], state: next };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); localStorage.setItem(CURRENT_KEY, normalized);
      replaceState(next); setError(null);
      return true;
    } catch (cause) {
      throw new Error(authMessage(cause));
    }
  }, [replaceState]);

  const login = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    try {
      const { data, error: loginError } = await getSupabaseClient().auth.signInWithPassword({ email: normalized, password });
      if (loginError) throw loginError;
      if (!data.user) throw new Error("Supabase did not return an authenticated user.");
      replaceState(restoreProfile(data.user)); setError(null);
    } catch (cause) { throw new Error(authMessage(cause)); }
  }, [replaceState]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const { error: oauthError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/game`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      throw new Error(authMessage(cause));
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter your email address first.");
    try {
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) throw resetError;
    } catch (cause) {
      throw new Error(authMessage(cause));
    }
  }, []);

  const linkGoogle = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await getSupabaseClient().auth.getUser();
      if (userError || !user) throw new Error("Sign in before linking Google.");
      const { error: linkError } = await getSupabaseClient().auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/profile` },
      });
      if (linkError) throw linkError;
      setError(null);
    } catch (cause) {
      throw new Error(authMessage(cause));
    }
  }, []);

  const updatePlayerProfile = useCallback(async (input: ProfileInput) => {
    try {
      const { data: { user }, error: userError } = await getSupabaseClient().auth.getUser();
      if (userError || !user) throw new Error("Sign in before editing your profile.");
      const profile = await savePlayerProfile(user.id, input);
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ data: { display_name: profile.handlerName, handler_name: profile.handlerName } });
      if (updateError) throw updateError;
      commit((draft) => {
        draft.profile = profile;
        if (draft.account) draft.account.username = profile.handlerName;
      }, "PROFILE_UPDATED", { handlerName: profile.handlerName });
    } catch (cause) {
      throw new Error(authMessage(cause));
    }
  }, [commit]);

  const logout = useCallback(async () => { await getSupabaseClient().auth.signOut(); localStorage.removeItem(CURRENT_KEY); replaceState(initialState); router.push("/"); }, [replaceState, router]);

  const saveComicProgress = useCallback((volumeId: string, pageIndex: number, completed = false) => commit((draft) => {
    draft.comicProgress ??= {};
    draft.comicProgress[volumeId] = {
      pageIndex: Math.max(0, Math.floor(pageIndex)),
      completed,
      updatedAt: new Date().toISOString(),
    };
  }, "COMIC_PROGRESS_SAVED", { volumeId, pageIndex, completed }), [commit]);

  const reveal = useCallback((openingId: string, cardId?: string) => commit((draft) => {
    const opening = draft.openings.find((item) => item.id === openingId); if (!opening) throw new Error("Opening not found");
    opening.cards.forEach((card) => { if (!cardId || card.id === cardId) card.revealed = true; });
    opening.complete = opening.cards.every((card) => card.revealed);
  }, "PACK_REVEALED", { openingId, cardId }), [commit]);
  const buyPack = useCallback((packId: string, order?: string) => {
    commit((draft) => buyPackRule(draft, packId, order), "PACK_PURCHASED", { packId, order });
    router.push("/open");
  }, [commit, router]);
  const activateBoost = useCallback((id: string) => commit((draft) => activateBoostRule(draft, id), "BOOST_ACTIVATED", { inventoryItemId: id }), [commit]);
  const saveLoadout = useCallback((loadout: Omit<Loadout, "id"> & { id?: string }) => commit((draft) => {
    if (loadout.mysticIds.length !== loadout.size) throw new Error(`Select exactly ${loadout.size} Mystics`);
    if (loadout.handlerIds.length > 3) throw new Error("Select no more than 3 Handlers");
    const next = { name: loadout.name.trim(), size: loadout.size, mysticIds: loadout.mysticIds, handlerIds: loadout.handlerIds };
    if (!next.name) throw new Error("Give the formation a name");
    const existing = loadout.id ? draft.loadouts.find((item) => item.id === loadout.id) : null;
    if (existing) Object.assign(existing, next);
    else draft.loadouts.push({ ...next, id: `loadout-${Date.now()}` });
  }, "LOADOUT_SAVED", { name: loadout.name, size: loadout.size, loadoutId: loadout.id }), [commit]);
  const deleteLoadout = useCallback((id: string) => commit((draft) => { draft.loadouts = draft.loadouts.filter((item) => item.id !== id); }, "LOADOUT_DELETED", { loadoutId: id }), [commit]);
  const setActiveLoadout = useCallback((id: string) => commit((draft) => setActiveLoadoutRule(draft, id), "LOADOUT_ACTIVATED", { loadoutId: id }), [commit]);
  const createBinder = useCallback((name: string) => commit((draft) => { if (!name.trim()) throw new Error("Give the collection a name"); draft.binders.push({ id: `binder-${Date.now()}`, name: name.trim(), cardIds: [] }); }, "BINDER_CREATED", { name }), [commit]);
  const renameBinder = useCallback((id: string, name: string) => commit((draft) => { const binder = draft.binders.find((item) => item.id === id); if (binder && name.trim()) binder.name = name.trim(); }, "BINDER_RENAMED", { binderId: id, name }), [commit]);
  const toggleBinderCard = useCallback((binderId: string, ownedId: string) => commit((draft) => { const binder = draft.binders.find((item) => item.id === binderId); if (!binder) return; binder.cardIds = binder.cardIds.includes(ownedId) ? binder.cardIds.filter((id) => id !== ownedId) : [...binder.cardIds, ownedId]; }, "BINDER_CARD_TOGGLED", { binderId, ownedId }), [commit]);
  const sellDuplicate = useCallback((ownedId: string) => commit((draft) => sellDuplicateCardRule(draft, ownedId), "CARD_SOLD", { ownedId }), [commit]);
  const dismantleCard = useCallback((ownedId: string) => commit((draft) => dismantleCardRule(draft, ownedId), "CARD_DISMANTLED", { ownedId }), [commit]);
  const levelUpCard = useCallback((ownedId: string) => commit((draft) => levelUpCardRule(draft, ownedId), "CARD_LEVELED_UP", { ownedId }), [commit]);
  const startBattle = useCallback((opponentId: string, selection?: BattleSelection) => {
    if (!selection) { router.push(`/battle?opponent=${encodeURIComponent(opponentId)}`); return; }
    commit((draft) => {
      createBattle(draft, opponentId, selection);
      if (draft.battle) applyProgressEvent(draft, { type: "BATTLE_STARTED", battleId: draft.battle.id, teamOrders: draft.battle.player.mystics.map(item => item.order), teamSize: draft.battle.size });
    }, "BATTLE_STARTED", { opponentId, loadoutId: selection.loadoutId, random: selection.random });
    router.replace("/battle");
  }, [commit, router]);

  const recordCompletion = (draft: PlayerState, wasComplete: boolean) => {
    const battle = draft.battle; if (!battle?.winner || wasComplete) return;
    const survivors = battle.player.mystics.filter(item => !item.defeated);
    const shared = { battleId: battle.id, teamOrders: battle.player.mystics.map(item => item.order), teamSize: battle.size, survivors: survivors.length, defeatedAllies: battle.player.mystics.length - survivors.length, maxSurvivorPowerPercent: Math.max(0, ...survivors.map(item => item.currentPower / item.maxPower * 100)), lineupKey: battle.player.mystics.map(item => item.definitionId).sort().join("|") };
    applyProgressEvent(draft, { type: "BATTLE_COMPLETED", ...shared });
    applyProgressEvent(draft, { type: battle.winner === "player" ? "BATTLE_WON" : "BATTLE_LOST", ...shared });
  };
  const finalize = (draft: PlayerState, wasComplete: boolean) => { recordCompletion(draft, wasComplete); if (draft.battle?.winner) rewardCompletedBattle(draft); };
  const basicAttack = useCallback((attackerId: string, defenderId: string) => commit((draft) => {
    if (!draft.battle) return; const battle = draft.battle; const wasComplete = Boolean(battle.winner); const actor = battle.player.mystics.find(item => item.instanceId === attackerId);
    const result = performBasicAttack(battle, "player", attackerId, defenderId);
    if (result.finalDamage > 0) { applyProgressEvent(draft, { type: "ATTACK_LANDED", attackKind: "basic", battleId: battle.id }); applyProgressEvent(draft, { type: "DAMAGE_DEALT", battleId: battle.id, value: result.finalDamage, actorOrder: actor?.order }); }
    if (actor?.handlerBonuses.sources.length) applyProgressEvent(draft, { type: "HANDLER_SUCCEEDED", battleId: battle.id });
    finalize(draft, wasComplete);
  }, "BASIC_ATTACK", { attackerId, defenderId }), [commit]);
  const specialAttack = useCallback((attackerId: string, defenderId: string, moveIndex: number, rolledFace?: number) => commit((draft) => {
    if (!draft.battle) return;
    let useProvidedRoll = rolledFace !== undefined;
    const dice = rolledFace === undefined ? undefined : { rollD8: () => {
      if (useProvidedRoll) { useProvidedRoll = false; return rolledFace; }
      return Math.floor(Math.random() * 8) + 1;
    } };
    const battle = draft.battle; const wasComplete = Boolean(battle.winner); const actor = battle.player.mystics.find(item => item.instanceId === attackerId);
    applyProgressEvent(draft, { type: "SPECIAL_ATTEMPTED", battleId: battle.id });
    const result = performSpecial(battle, "player", attackerId, defenderId, moveIndex, dice);
    if (result.success) applyProgressEvent(draft, { type: "SPECIAL_SUCCEEDED", battleId: battle.id });
    if (result.damage > 0) { applyProgressEvent(draft, { type: "ATTACK_LANDED", attackKind: "special", battleId: battle.id }); applyProgressEvent(draft, { type: "DAMAGE_DEALT", battleId: battle.id, value: result.damage, actorOrder: actor?.order }); }
    if (result.success && actor?.handlerBonuses.sources.length) applyProgressEvent(draft, { type: "HANDLER_SUCCEEDED", battleId: battle.id });
    finalize(draft, wasComplete);
  }, "SPECIAL_ATTACK", { attackerId, defenderId, moveIndex, rolledFace }), [commit]);

  const aiTurn = useCallback(() => commit((draft) => {
    const battle = draft.battle; if (!battle || battle.currentTurn !== "ai" || battle.winner) return; const wasComplete = Boolean(battle.winner);
    const actors = battle.ai.mystics.filter((m) => !m.defeated);
    const enemies = battle.player.mystics.filter((m) => !m.defeated);
    const profile = findStage(ORDER_CAMPAIGNS, battle.campaignId ?? "")?.stage.aiLogicProfile ?? "balanced";
    const actor = [...actors].sort((a, b) => b.baseAttack - a.baseAttack)[Math.floor(Math.random() * Math.min(2, actors.length))] ?? actors[0];
    // Defensive AI neutralizes the biggest threat first; aggressive/balanced both finish off the weakest (aggressive differs via move choice below).
    const target = profile === "defensive" ? [...enemies].sort((a, b) => b.baseAttack - a.baseAttack)[0] : [...enemies].sort((a, b) => a.currentPower - b.currentPower)[0];

    const available = actor.moves.map((move, index) => ({ move, index })).filter(({ move }) => (actor.cooldowns[move.name] ?? 0) === 0 && !move.needsReview);
    const damaging = available.map((entry) => ({ ...entry, preview: entry.move.targetType === "enemy" ? previewDamage(actor, target, entry.move, battle.ai.synergies) : null })).filter((entry) => entry.preview);
    const lethal = damaging.find((entry) => entry.preview!.finalDamage >= target.currentPower);
    const bestDamage = [...damaging].sort((a, b) => b.preview!.finalDamage - a.preview!.finalDamage)[0];
    const hasAdvantage = orderAdvantagePercent(actor.order, target.order) > 0;
    // Never pass up a kill; capitalize on Order Advantage when it's live; otherwise fall back to the existing damage-modifier-first heuristic, biased by aiLogicProfile.
    const specialChance = profile === "aggressive" ? 0.8 : profile === "defensive" ? 0.5 : 0.62;
    const choice = lethal ?? (hasAdvantage && bestDamage ? bestDamage : available.length && Math.random() < specialChance ? [...available].sort((a, b) => (b.move.damageModifierPercent ?? 0) - (a.move.damageModifierPercent ?? 0))[0] : null);

    if (choice) {
      const specialTarget = choice.move.targetType === "ally" ? [...battle.ai.mystics].filter(m => !m.defeated).sort((a, b) => a.currentPower / a.maxPower - b.currentPower / b.maxPower)[0] : choice.move.targetType === "self" ? actor : target;
      performSpecial(battle, "ai", actor.instanceId, specialTarget.instanceId, choice.index);
    }
    else performBasicAttack(battle, "ai", actor.instanceId, target.instanceId);
    finalize(draft, wasComplete);
  }, "AI_TURN"), [commit]);

  const claimDailyPack = useCallback(async () => {
    try {
      const next = await claimDailyPackFromServer(); migrateLegacyState(next); replaceState(next); saveLocalState(next); router.push("/open"); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not claim the Daily Pack."); throw cause; }
  }, [replaceState, router]);
  const claimDailyChallenge = useCallback(async () => {
    try {
      await queueCloudGameState(stateRef.current, "PROGRESSION_SYNC");
      const next = await claimDailyChallengeFromServer();
      migrateLegacyState(next); replaceState(next); saveLocalState(next); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not claim the Daily Challenge reward."); throw cause; }
  }, [replaceState]);
  const claimSeasonTier = useCallback(async (tier: number) => {
    try {
      await queueCloudGameState(stateRef.current, "PROGRESSION_SYNC");
      const next = await claimSeasonTierFromServer(tier);
      migrateLegacyState(next); replaceState(next); saveLocalState(next); setError(null);
      const opening = next.openings.find(item => item.id === next.activeOpeningId);
      if (opening?.source === "season" && !opening.complete) router.push("/open");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not claim the Season reward."); throw cause; }
  }, [replaceState, router]);
  const dismissNotification = useCallback((id: string) => commit(draft => dismissNotificationRule(draft, id), "NOTIFICATION_READ", { id }), [commit]);

  const value = useMemo<GameContextValue>(() => ({ state, ready, error, signup, login, loginWithGoogle, requestPasswordReset, linkGoogle, updatePlayerProfile, logout, saveComicProgress, reveal, buyPack, activateBoost, saveLoadout, deleteLoadout, setActiveLoadout, createBinder, renameBinder, toggleBinderCard, sellDuplicate, dismantleCard, levelUpCard, startBattle, basicAttack, specialAttack, aiTurn, claimDailyPack, claimDailyChallenge, claimSeasonTier, dismissNotification }), [state, ready, error, signup, login, loginWithGoogle, requestPasswordReset, linkGoogle, updatePlayerProfile, logout, saveComicProgress, reveal, buyPack, activateBoost, saveLoadout, deleteLoadout, setActiveLoadout, createBinder, renameBinder, toggleBinderCard, sellDuplicate, dismantleCard, levelUpCard, startBattle, basicAttack, specialAttack, aiTurn, claimDailyPack, claimDailyChallenge, claimSeasonTier, dismissNotification]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() { const value = useContext(GameContext); if (!value) throw new Error("useGame must be used inside GameProvider"); return value; }
