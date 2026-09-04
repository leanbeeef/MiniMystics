"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from "firebase/auth";
import { activateBoost as activateBoostRule, buyPack as buyPackRule, CAMPAIGN, catalog, createAccount, createBattle, definitionFor, initialState, rewardCompletedBattle, type Binder, type Loadout, type PlayerState } from "@/lib/client-state";
import { endTurn, performBasicAttack, performSpecial } from "@/lib/game/engine";
import { firebaseAuth } from "@/lib/firebase";

type Accounts = Record<string, { passwordHash?: string; state: PlayerState }>;
type GameContextValue = {
  state: PlayerState;
  ready: boolean;
  error: string | null;
  signup(email: string, username: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  reveal(openingId: string, cardId?: string): void;
  buyPack(packId: string, order?: string): void;
  activateBoost(id: string): void;
  saveLoadout(loadout: Omit<Loadout, "id">): void;
  deleteLoadout(id: string): void;
  createBinder(name: string): void;
  renameBinder(id: string, name: string): void;
  toggleBinderCard(binderId: string, ownedId: string): void;
  sellDuplicate(ownedId: string): void;
  startBattle(opponentId: string, loadoutId?: string): void;
  basicAttack(attackerId: string, defenderId: string): void;
  specialAttack(attackerId: string, defenderId: string, moveIndex: number, rolledFace?: number): void;
  useHandler(handlerIndex: number, targetId: string, rolledFace?: number): void;
  aiTurn(): void;
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
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Could not reach Firebase. Check your connection and try again.",
    "auth/operation-not-allowed": "Email and password sign-in is not enabled yet.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/weak-password": "Choose a password with at least 8 characters.",
  };
  return messages[code] ?? "Could not authenticate with Firebase.";
}

function restoreProfile(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return initialState;
  const accounts = getAccounts();
  let saved = accounts[email]?.state;
  let changed = false;
  if (!saved) {
    const fallbackName = user.displayName?.trim() || email.split("@")[0] || "Handler";
    saved = createAccount(email, fallbackName);
    changed = true;
  }
  if (!Array.isArray(saved.campaignWins)) { saved.campaignWins = []; changed = true; }
  const campaign = CAMPAIGN.find((opponent) => opponent.id === saved.battle?.campaignId || opponent.name === saved.battle?.ai.name);
  if (saved.battle && campaign && !saved.battle.campaignId) { saved.battle.campaignId = campaign.id; changed = true; }
  if (saved.battle?.winner === "player" && saved.battleRewarded && campaign && !saved.campaignWins.includes(campaign.id)) {
    saved.campaignWins.push(campaign.id);
    changed = true;
  }
  if (changed || !accounts[email]) {
    accounts[email] = { ...accounts[email], state: saved };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
  localStorage.setItem(CURRENT_KEY, email);
  return saved;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>(initialState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (user) => {
      if (user) setState(restoreProfile(user));
      else { localStorage.removeItem(CURRENT_KEY); setState(initialState); }
      setReady(true);
    }, (cause) => { setError(authMessage(cause)); setReady(true); });
  }, []);

  const commit = useCallback((mutator: (draft: PlayerState) => void) => {
    setState((current) => {
      const draft = structuredClone(current);
      try { mutator(draft); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong"); return current; }
      const email = draft.account?.email;
      if (email) {
        const accounts = getAccounts();
        const existing = accounts[email];
        accounts[email] = { ...existing, state: draft };
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      }
      return draft;
    });
  }, []);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || username.trim().length < 2 || password.length < 8) throw new Error("Use a valid email, a username, and at least 8 password characters.");
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, normalized, password);
      await updateProfile(credential.user, { displayName: username.trim() });
      const accounts = getAccounts();
      const next = accounts[normalized]?.state ?? createAccount(normalized, username.trim());
      next.account = { email: normalized, username: username.trim() };
      accounts[normalized] = { ...accounts[normalized], state: next };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); localStorage.setItem(CURRENT_KEY, normalized);
      setState(next); setError(null);
    } catch (cause) { throw new Error(authMessage(cause)); }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const normalized = email.trim().toLowerCase();
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, normalized, password);
      setState(restoreProfile(credential.user)); setError(null);
    } catch (cause) { throw new Error(authMessage(cause)); }
  }, []);

  const logout = useCallback(async () => { await signOut(firebaseAuth); localStorage.removeItem(CURRENT_KEY); setState(initialState); router.push("/"); }, [router]);

  const reveal = useCallback((openingId: string, cardId?: string) => commit((draft) => {
    const opening = draft.openings.find((item) => item.id === openingId); if (!opening) throw new Error("Opening not found");
    opening.cards.forEach((card) => { if (!cardId || card.id === cardId) card.revealed = true; });
    opening.complete = opening.cards.every((card) => card.revealed);
  }), [commit]);
  const buyPack = useCallback((packId: string, order?: string) => commit((draft) => buyPackRule(draft, packId, order)), [commit]);
  const activateBoost = useCallback((id: string) => commit((draft) => activateBoostRule(draft, id)), [commit]);
  const saveLoadout = useCallback((loadout: Omit<Loadout, "id">) => commit((draft) => {
    if (loadout.mysticIds.length !== loadout.size) throw new Error(`Select exactly ${loadout.size} Mystics`);
    if (loadout.handlerIds.length > 3) throw new Error("Select no more than 3 Handlers");
    draft.loadouts.push({ ...loadout, id: `loadout-${Date.now()}` });
  }), [commit]);
  const deleteLoadout = useCallback((id: string) => commit((draft) => { draft.loadouts = draft.loadouts.filter((item) => item.id !== id); }), [commit]);
  const createBinder = useCallback((name: string) => commit((draft) => { if (!name.trim()) throw new Error("Give the collection a name"); draft.binders.push({ id: `binder-${Date.now()}`, name: name.trim(), cardIds: [] }); }), [commit]);
  const renameBinder = useCallback((id: string, name: string) => commit((draft) => { const binder = draft.binders.find((item) => item.id === id); if (binder && name.trim()) binder.name = name.trim(); }), [commit]);
  const toggleBinderCard = useCallback((binderId: string, ownedId: string) => commit((draft) => { const binder = draft.binders.find((item) => item.id === binderId); if (!binder) return; binder.cardIds = binder.cardIds.includes(ownedId) ? binder.cardIds.filter((id) => id !== ownedId) : [...binder.cardIds, ownedId]; }), [commit]);
  const sellDuplicate = useCallback((ownedId: string) => commit((draft) => {
    const owned = draft.ownedCards.find((card) => card.id === ownedId); if (!owned) return;
    const copies = draft.ownedCards.filter((card) => card.definitionId === owned.definitionId); if (copies.length < 2) throw new Error("Only duplicate copies can be sold");
    const definition = definitionFor(owned.definitionId)!; const values: Record<string, number> = { Wild: 20, Hunter: 35, Predator: 60, Prime: 100, Alpha: 180, Apex: 350, Unassigned: 80 };
    draft.ownedCards = draft.ownedCards.filter((card) => card.id !== ownedId); draft.coins += values[definition.rarity]; draft.binders.forEach((binder) => binder.cardIds = binder.cardIds.filter((id) => id !== ownedId));
  }), [commit]);
  const startBattle = useCallback((opponentId: string, loadoutId?: string) => { commit((draft) => createBattle(draft, opponentId, loadoutId)); router.push("/battle"); }, [commit, router]);

  const finalize = (draft: PlayerState) => { if (draft.battle?.winner) rewardCompletedBattle(draft); };
  const basicAttack = useCallback((attackerId: string, defenderId: string) => commit((draft) => { if (!draft.battle) return; performBasicAttack(draft.battle, "player", attackerId, defenderId); finalize(draft); }), [commit]);
  const specialAttack = useCallback((attackerId: string, defenderId: string, moveIndex: number, rolledFace?: number) => commit((draft) => {
    if (!draft.battle) return;
    let useProvidedRoll = rolledFace !== undefined;
    const dice = rolledFace === undefined ? undefined : { rollD6: () => {
      if (useProvidedRoll) { useProvidedRoll = false; return rolledFace; }
      return Math.floor(Math.random() * 6) + 1;
    } };
    performSpecial(draft.battle, "player", attackerId, defenderId, moveIndex, dice);
    finalize(draft);
  }), [commit]);

  const useHandler = useCallback((handlerIndex: number, targetId: string, rolledFace?: number) => commit((draft) => {
    const battle = draft.battle; if (!battle || battle.currentTurn !== "player" || battle.winner) throw new Error("It is not your turn");
    const owned = battle.player.handlers[handlerIndex]; if (!owned || owned.uses >= owned.maxUses) throw new Error("Handler has no uses remaining");
    const handler = catalog.handlers.find((item) => item.id === owned.definitionId)!;
    const side = handler.target === "ally" ? battle.player : battle.ai;
    const target = side.mystics.find((m) => m.instanceId === targetId && !m.defeated); if (!target) throw new Error("Choose a valid target");
    const roll = rolledFace ?? Math.floor(Math.random() * 6) + 1; const success = handler.exactRoll ? roll === handler.activationRoll : roll >= handler.activationRoll;
    owned.uses += 1; battle.lastRoll = roll;
    battle.events.push({ id: `handler-${Date.now()}`, turn: battle.turnNumber, type: "handler", message: `${handler.name} rolled ${roll}. ${success ? handler.effect.split(":")[0] + " activated." : "Activation failed."}` });
    if (success) {
      const effect = handler.effectType.toLowerCase();
      if (handler.id === "H-001") { target.effects.push({ id: `h-${battle.turnNumber}-a`, kind: "attack", value: 5, expiresAt: "sourceTurnStart", sourceSide: "player" }, { id: `h-${battle.turnNumber}-d`, kind: "defense", value: 3, expiresAt: "sourceTurnStart", sourceSide: "player" }); }
      else if (handler.id === "H-002") target.effects.push({ id: `h-${battle.turnNumber}`, kind: "reroll", value: 1, expiresAt: "sourceTurnStart", sourceSide: "player" });
      else if (handler.id === "H-003") { const cooling = Object.entries(target.cooldowns).sort((a, b) => b[1] - a[1])[0]; if (cooling) target.cooldowns[cooling[0]] = Math.max(0, cooling[1] - 1); }
      else if (handler.id === "H-004") target.effects.push({ id: `h-${battle.turnNumber}`, kind: "attack", value: 8, expiresAt: "onAttack", sourceSide: "player" });
      else if (handler.id === "H-005") { const enemy = [...battle.ai.mystics].filter((m) => !m.defeated).sort((a, b) => a.currentPower - b.currentPower)[0]; const attack = target.baseAttack; const damage = Math.max(1, attack - enemy.defense); enemy.currentPower = Math.max(0, enemy.currentPower - damage); enemy.defeated = enemy.currentPower === 0; battle.events.push({ id: `command-${Date.now()}`, turn: battle.turnNumber, type: "damage", message: `${target.name} dealt ${damage} damage to ${enemy.name} by Battle Command.` }); }
      else if (handler.id === "H-006") target.effects.push({ id: `h-${battle.turnNumber}`, kind: "defense", value: 6, expiresAt: "sourceTurnStart", sourceSide: "player" });
      else if (handler.id === "H-007") { target.effects.push({ id: `h-${battle.turnNumber}-d`, kind: "defense", value: -8, expiresAt: "sourceTurnStart", sourceSide: "player" }, { id: `h-${battle.turnNumber}-l`, kind: "specialLock", value: 1, expiresAt: "ownerTurnStart", sourceSide: "player" }); }
      else if (handler.id === "H-008") target.effects.push({ id: `h-${battle.turnNumber}`, kind: "marked", value: 6, expiresAt: "sourceTurnStart", sourceSide: "player" });
      else if (handler.id === "H-009") target.effects.push({ id: `h-${battle.turnNumber}`, kind: "evade", value: 1, expiresAt: "sourceTurnStart", sourceSide: "player" });
      else if (effect.includes("attack buff")) target.effects.push({ id: `h-${battle.turnNumber}`, kind: "attack", value: 5, expiresAt: "sourceTurnStart", sourceSide: "player" });
    }
    if (battle.ai.mystics.every((m) => m.defeated)) battle.winner = "player";
    if (!battle.winner) endTurn(battle); finalize(draft);
  }), [commit]);

  const aiTurn = useCallback(() => commit((draft) => {
    const battle = draft.battle; if (!battle || battle.currentTurn !== "ai" || battle.winner) return;
    const actors = battle.ai.mystics.filter((m) => !m.defeated); const targets = battle.player.mystics.filter((m) => !m.defeated).sort((a, b) => a.currentPower - b.currentPower);
    const actor = [...actors].sort((a, b) => b.baseAttack - a.baseAttack)[Math.floor(Math.random() * Math.min(2, actors.length))] ?? actors[0]; const target = targets[0];
    const available = actor.moves.map((move, index) => ({ move, index })).filter(({ move }) => (actor.cooldowns[move.name] ?? 0) === 0 && !move.needsReview);
    if (available.length && Math.random() > 0.38) { const choice = available.sort((a, b) => (b.move.attackModifier ?? 0) - (a.move.attackModifier ?? 0))[0]; performSpecial(battle, "ai", actor.instanceId, target.instanceId, choice.index); }
    else performBasicAttack(battle, "ai", actor.instanceId, target.instanceId);
    finalize(draft);
  }), [commit]);

  const value = useMemo<GameContextValue>(() => ({ state, ready, error, signup, login, logout, reveal, buyPack, activateBoost, saveLoadout, deleteLoadout, createBinder, renameBinder, toggleBinderCard, sellDuplicate, startBattle, basicAttack, specialAttack, useHandler, aiTurn }), [state, ready, error, signup, login, logout, reveal, buyPack, activateBoost, saveLoadout, deleteLoadout, createBinder, renameBinder, toggleBinderCard, sellDuplicate, startBattle, basicAttack, specialAttack, useHandler, aiTurn]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() { const value = useContext(GameContext); if (!value) throw new Error("useGame must be used inside GameProvider"); return value; }
