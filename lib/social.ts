import { deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, updateDoc, where, collection } from "firebase/firestore";
import { getFirebaseFirestore } from "./firebase";
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

const pairId = (first: string, second: string) => [first, second].sort().join("_");

export async function findProfileByHandler(handlerName: string) {
  const snapshot = await getDocs(query(collection(getFirebaseFirestore(), "profiles"), where("handleNormalized", "==", normalizeHandlerName(handlerName))));
  return snapshot.empty ? null : snapshot.docs[0].data() as PlayerProfile;
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  if (fromUid === toUid) throw new Error("You cannot send a friend request to yourself.");
  const db = getFirebaseFirestore();
  const friendshipRef = doc(db, "friendships", pairId(fromUid, toUid));
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(friendshipRef);
    if (existing.exists()) throw new Error(existing.data().status === "friends" ? "You are already friends." : "A friend request is already pending.");
    const now = new Date().toISOString();
    transaction.set(friendshipRef, { members: [fromUid, toUid].sort(), requestedBy: fromUid, status: "pending", createdAt: now, updatedAt: now });
  });
}

export async function acceptFriendRequest(friendshipId: string) {
  await updateDoc(doc(getFirebaseFirestore(), "friendships", friendshipId), { status: "friends", updatedAt: new Date().toISOString() });
}

export async function removeFriendship(friendshipId: string) {
  await deleteDoc(doc(getFirebaseFirestore(), "friendships", friendshipId));
}

export function subscribeToFriends(uid: string, callback: (entries: FriendEntry[]) => void, onError: (error: Error) => void) {
  const relationships = query(collection(getFirebaseFirestore(), "friendships"), where("members", "array-contains", uid));
  return onSnapshot(relationships, async (snapshot) => {
    try {
      const entries = await Promise.all(snapshot.docs.map(async (item) => {
        const friendship = { id: item.id, ...item.data() } as Friendship;
        const otherUid = friendship.members.find((member) => member !== uid)!;
        const profileSnapshot = await getDoc(doc(getFirebaseFirestore(), "profiles", otherUid));
        const direction = friendship.status === "friends" ? "friends" : friendship.requestedBy === uid ? "outgoing" : "incoming";
        return { ...friendship, profile: profileSnapshot.exists() ? profileSnapshot.data() as PlayerProfile : null, direction } as FriendEntry;
      }));
      callback(entries.sort((a, b) => (a.profile?.handlerName ?? "").localeCompare(b.profile?.handlerName ?? "")));
    } catch (cause) {
      onError(cause instanceof Error ? cause : new Error("Could not load friends."));
    }
  }, (cause) => onError(cause));
}
