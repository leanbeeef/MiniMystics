"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { useGame } from "./game-provider";
import { getSupabaseClient } from "@/lib/supabase";
import { acceptFriendRequest, findProfileByHandler, removeFriendship, sendFriendRequest, subscribeToFriends, type FriendEntry } from "@/lib/social";
import type { PlayerProfile } from "@/lib/player-profile";
import { optimizedAsset } from "@/lib/asset-url";

function FriendRow({ entry, onAction }: { entry: FriendEntry; onAction: (action: "accept" | "remove") => void }) {
  const profile = entry.profile;
  return <article className="friend-row"><div className="friend-avatar"><img src={optimizedAsset(profile?.avatarPath ?? null) ?? undefined} alt="" loading="lazy" decoding="async" /></div><div><strong>{profile?.handlerName ?? "Unknown Handler"}</strong><span>{profile?.allegiance ?? "Unknown allegiance"} · {profile?.region ?? "Unknown region"}</span></div><span className={`friend-state ${entry.direction}`}>{entry.direction === "friends" ? "FRIENDS" : entry.direction === "incoming" ? "REQUEST RECEIVED" : "REQUEST SENT"}</span>{entry.direction === "incoming" ? <div className="friend-actions"><button className="accept" onClick={() => onAction("accept")}><Check />Accept</button><button onClick={() => onAction("remove")}><X />Decline</button></div> : entry.direction === "friends" ? <button className="friend-remove" onClick={() => onAction("remove")}><UserMinus />Remove</button> : <button className="friend-remove" onClick={() => onAction("remove")}><X />Cancel</button>}</article>;
}

export function FriendsView() {
  const { state } = useGame();
  const [entries, setEntries] = useState<FriendEntry[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PlayerProfile | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string>();

  useEffect(() => {
    let active = true;
    void getSupabaseClient().auth.getUser().then(({ data }) => {
      if (active) setUid(data.user?.id);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!uid) return;
    return subscribeToFriends(uid, setEntries, (cause) => setMessage(cause.message));
  }, [uid]);

  const grouped = useMemo(() => ({
    incoming: entries.filter((entry) => entry.direction === "incoming"),
    friends: entries.filter((entry) => entry.direction === "friends"),
    outgoing: entries.filter((entry) => entry.direction === "outgoing"),
  }), [entries]);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true); setMessage(""); setResult(null);
    try {
      const found = await findProfileByHandler(query);
      if (!found) setMessage("No Handler found with that exact name.");
      else if (found.uid === uid) setMessage("That is your own Handler profile.");
      else setResult(found);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Search failed."); }
    finally { setBusy(false); }
  };

  const request = async () => {
    if (!uid || !result) return;
    setBusy(true); setMessage("");
    try { await sendFriendRequest(uid, result.uid); setMessage(`Friend request sent to ${result.handlerName}.`); setResult(null); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not send the request."); }
    finally { setBusy(false); }
  };

  const act = async (entry: FriendEntry, action: "accept" | "remove") => {
    try { if (action === "accept") await acceptFriendRequest(entry.id); else await removeFriendship(entry.id); setMessage(action === "accept" ? `You and ${entry.profile?.handlerName} are now friends.` : "Friend relationship updated."); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not update that request."); }
  };

  return <div className="page friends-page">
    <div className="page-head"><div><span className="eyebrow">SOCIAL CIRCLE</span><h1>Friends</h1><p>Find another player by their exact Handler name.</p></div><div className="friends-count"><UsersRound /><strong>{grouped.friends.length}</strong><span>Friends</span></div></div>
    <form className="friend-search panel" onSubmit={search}><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Handler name" aria-label="Handler name" /><button className="button primary" disabled={busy}>Search</button></form>
    {message ? <p className="friend-message" role="status">{message}</p> : null}
    {result ? <section className="friend-result panel"><div className="friend-avatar large"><img src={optimizedAsset(result.avatarPath) ?? result.avatarPath} alt="" decoding="async" /></div><div><span>HANDLER FOUND</span><h2>{result.handlerName}</h2><p>{result.tagline || `${result.allegiance} · ${result.region}`}</p></div><button className="button primary" disabled={busy || entries.some((entry) => entry.members.includes(result.uid))} onClick={request}><UserPlus />Send request</button></section> : null}
    <div className="friends-columns">
      <section className="panel friend-list"><div className="panel-title"><span>FRIENDS</span><small>{grouped.friends.length}</small></div>{grouped.friends.length ? grouped.friends.map((entry) => <FriendRow key={entry.id} entry={entry} onAction={(action) => act(entry, action)} />) : <div className="social-empty"><UsersRound /><strong>Your circle is empty</strong><span>Search for a Handler to send your first request.</span></div>}</section>
      <aside className="friend-request-stack"><section className="panel friend-list"><div className="panel-title"><span>INCOMING</span><small>{grouped.incoming.length}</small></div>{grouped.incoming.length ? grouped.incoming.map((entry) => <FriendRow key={entry.id} entry={entry} onAction={(action) => act(entry, action)} />) : <p className="friend-list-empty">No incoming requests.</p>}</section><section className="panel friend-list"><div className="panel-title"><span>SENT</span><small>{grouped.outgoing.length}</small></div>{grouped.outgoing.length ? grouped.outgoing.map((entry) => <FriendRow key={entry.id} entry={entry} onAction={(action) => act(entry, action)} />) : <p className="friend-list-empty">No pending requests.</p>}</section></aside>
    </div>
  </div>;
}
