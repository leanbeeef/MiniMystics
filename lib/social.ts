import { getFirebaseAuth } from "./firebase";
import { normalizeHandlerName, type PlayerProfile } from "./player-profile";

export type FriendshipStatus = "pending" | "friends";
export type Friendship = {
  id: string;
  members: [string, string];
  requestedBy: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
};

export type FriendEntry = Friendship & { profile: PlayerProfile | null; direction: "incoming" | "outgoing" | "friends" };

async function authenticatedHeaders(json = false): Promise<Record<string, string>> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) throw new Error("Sign in to manage your friends.");
  return {
    Authorization: `Bearer ${await currentUser.getIdToken()}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

function announceChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mini-mystics:friends-changed"));
}

export async function findProfileByHandler(handlerName: string) {
  const normalized = normalizeHandlerName(handlerName);
  const response = await fetch(`/api/friends?handler=${encodeURIComponent(normalized)}`, {
    headers: await authenticatedHeaders(),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response, "Could not search for that Handler.");
  return response.json() as Promise<PlayerProfile>;
}

export async function sendFriendRequest(_fromUid: string, toUid: string) {
  const response = await fetch("/api/friends", {
    method: "POST",
    headers: await authenticatedHeaders(true),
    body: JSON.stringify({ recipientUid: toUid }),
  });
  if (!response.ok) throw await responseError(response, "Could not send the friend request.");
  announceChange();
}

export async function acceptFriendRequest(friendshipId: string) {
  const response = await fetch("/api/friends", {
    method: "PATCH",
    headers: await authenticatedHeaders(true),
    body: JSON.stringify({ friendshipId }),
  });
  if (!response.ok) throw await responseError(response, "Could not accept the friend request.");
  announceChange();
}

export async function removeFriendship(friendshipId: string) {
  const response = await fetch("/api/friends", {
    method: "DELETE",
    headers: await authenticatedHeaders(true),
    body: JSON.stringify({ friendshipId }),
  });
  if (!response.ok) throw await responseError(response, "Could not update that friendship.");
  announceChange();
}

export function subscribeToFriends(_uid: string, callback: (entries: FriendEntry[]) => void, onError: (error: Error) => void) {
  let active = true;
  const load = async () => {
    try {
      const response = await fetch("/api/friends", { headers: await authenticatedHeaders(), cache: "no-store" });
      if (!response.ok) throw await responseError(response, "Could not load friends.");
      const entries = await response.json() as FriendEntry[];
      if (active) callback(entries);
    } catch (cause) {
      if (active) onError(cause instanceof Error ? cause : new Error("Could not load friends."));
    }
  };
  const refresh = () => { void load(); };
  void load();
  const timer = window.setInterval(load, 15_000);
  window.addEventListener("mini-mystics:friends-changed", refresh);
  return () => {
    active = false;
    window.clearInterval(timer);
    window.removeEventListener("mini-mystics:friends-changed", refresh);
  };
}
