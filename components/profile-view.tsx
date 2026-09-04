"use client";

import { useMemo, useState } from "react";
import { Check, ImagePlus, Link2, LoaderCircle, MapPin, Pencil, ShieldCheck, Sparkles, Swords, Target, Trophy } from "lucide-react";
import { useGame } from "./game-provider";
import { ALLEGIANCE_ART, PROFILE_AVATARS, RANK_ART } from "@/lib/art";
import { catalog } from "@/lib/client-state";
import { getFirebaseAuth } from "@/lib/firebase";
import { optimizedAsset } from "@/lib/asset-url";
import { ALLEGIANCES, isHandlerAvailable, REGIONS, validateHandlerName, type ProfileInput } from "@/lib/player-profile";
import { xpForLevel } from "@/lib/game/rewards";

type Availability = "idle" | "checking" | "available" | "taken";

export function ProfileView() {
  const { state, updatePlayerProfile, linkGoogle } = useGame();
  const profile = state.profile;
  const [editing, setEditing] = useState(!profile);
  const [form, setForm] = useState<ProfileInput>({
    handlerName: profile?.handlerName ?? state.account?.username ?? "Handler",
    avatarPath: profile?.avatarPath ?? PROFILE_AVATARS[0].path,
    tagline: profile?.tagline ?? "",
    region: profile?.region ?? REGIONS[0],
    allegiance: profile?.allegiance ?? ALLEGIANCES[0],
    favoriteMysticId: profile?.favoriteMysticId ?? null,
  });
  const [availability, setAvailability] = useState<Availability>("idle");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(() => getFirebaseAuth().currentUser?.providerData.some((item) => item.providerId === "google.com") ?? false);

  const ownedMystics = useMemo(() => {
    const ids = new Set(state.ownedCards.map((owned) => owned.definitionId));
    return catalog.mystics.filter((mystic) => ids.has(mystic.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.ownedCards]);
  const uniqueCards = new Set(state.ownedCards.map((card) => card.definitionId)).size;
  const winRate = state.matches ? Math.round(state.wins / state.matches * 100) : 0;
  const favorite = catalog.mystics.find((mystic) => mystic.id === (profile?.favoriteMysticId ?? form.favoriteMysticId));
  const rankName = profile?.rankedTier?.split(" ")[0] ?? "Wild";

  const checkName = async () => {
    const validation = validateHandlerName(form.handlerName);
    if (validation) { setMessage(validation); setAvailability("taken"); return false; }
    setAvailability("checking");
    try {
      const result = await isHandlerAvailable(form.handlerName, getFirebaseAuth().currentUser?.uid);
      setAvailability(result.available ? "available" : "taken");
      setMessage(result.error ?? (result.available ? "Handler name available." : "That Handler name is unavailable."));
      return result.available;
    } catch {
      setAvailability("idle");
      setMessage("Could not check that name right now.");
      return false;
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !(await checkName())) return;
    setSaving(true);
    try {
      await updatePlayerProfile(form);
      setMessage("Handler profile saved.");
      setEditing(false);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const connectGoogle = async () => {
    setMessage("");
    try {
      await linkGoogle();
      setGoogleLinked(true);
      setMessage("Google sign-in linked.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not link Google.");
    }
  };

  return <div className="page identity-page">
    <section className="identity-hero">
      <div className="identity-avatar"><img src={optimizedAsset(profile?.avatarPath ?? form.avatarPath) ?? form.avatarPath} alt="" decoding="async" /></div>
      <div className="identity-copy"><span>HANDLER RECORD</span><h1>{profile?.handlerName ?? form.handlerName}</h1><p>{profile?.tagline || "No Handler tagline yet."}</p><div><span><MapPin />{profile?.region ?? form.region}</span><span><ShieldCheck />{profile?.allegiance ?? form.allegiance}</span></div></div>
      <div className="identity-rank"><img src={RANK_ART[rankName]} alt="" /><span>RANKED</span><strong>{profile?.rankedTier ?? "Wild III"}</strong><small>Season 1 · The First Convergence</small></div>
      <button className="button ghost identity-edit" onClick={() => setEditing((value) => !value)}><Pencil />{editing ? "Close editor" : "Edit profile"}</button>
    </section>

    <section className="profile-stat-grid">
      <article><Trophy /><strong>{state.wins}</strong><span>Wins</span></article>
      <article><Swords /><strong>{state.matches}</strong><span>Matches played</span></article>
      <article><Target /><strong>{winRate}%</strong><span>Win rate</span></article>
      <article><Sparkles /><strong>{uniqueCards}</strong><span>Unique cards</span></article>
      <article><span className="level-glyph">{state.level}</span><strong>{state.xp}</strong><span>XP / {xpForLevel(state.level)}</span></article>
    </section>

    <div className={`identity-layout ${editing ? "editing" : ""}`}>
      <section className="panel identity-detail-card">
        <div className="panel-title"><span>PLAYER IDENTITY</span></div>
        <dl><div><dt>Handler name</dt><dd>{profile?.handlerName ?? form.handlerName}</dd></div><div><dt>Region</dt><dd>{profile?.region ?? form.region}</dd></div><div><dt>Allegiance</dt><dd>{profile?.allegiance ?? form.allegiance}</dd></div><div><dt>Top Mystic</dt><dd>{favorite?.name ?? "Not selected"}</dd></div></dl>
        {favorite?.image ? <div className="profile-favorite"><img src={favorite.image} alt={`${favorite.name} card`} /><div><span>FAVORITE MYSTIC</span><strong>{favorite.name}</strong><small>{favorite.order} · {favorite.rarity}</small></div></div> : null}
        <div className="profile-auth-method"><div><span>ACCOUNT ACCESS</span><strong>{googleLinked ? "Google connected" : "Email and password"}</strong></div>{googleLinked ? <Check /> : <button onClick={connectGoogle}><Link2 />Link Google</button>}</div>
      </section>

      {editing ? <form className="panel identity-editor" onSubmit={save}>
        <div className="panel-title"><span>CUSTOMIZE PROFILE</span><small>Public details</small></div>
        <label className="identity-field"><span>Handler name</span><div><input value={form.handlerName} maxLength={20} onChange={(event) => { setForm({ ...form, handlerName: event.target.value }); setAvailability("idle"); setMessage(""); }} onBlur={checkName} /><button type="button" onClick={checkName}>{availability === "checking" ? <LoaderCircle className="spin" /> : availability === "available" ? <Check /> : "Check"}</button></div><small>3–20 characters · letters, numbers, _ or -</small></label>
        <label className="identity-field"><span>Tagline</span><textarea value={form.tagline} maxLength={80} placeholder="A short line other players will see" onChange={(event) => setForm({ ...form, tagline: event.target.value })} /><small>{form.tagline.length}/80</small></label>
        <div className="identity-field"><span>Avatar</span><div className="avatar-picker">{PROFILE_AVATARS.map((avatar) => <button type="button" className={form.avatarPath === avatar.path ? "active" : ""} key={avatar.id} onClick={() => setForm({ ...form, avatarPath: avatar.path })}><img src={optimizedAsset(avatar.path) ?? avatar.path} alt="" loading="lazy" decoding="async" /><small>{avatar.name}</small></button>)}<div className="avatar-upload-locked"><ImagePlus /><span>Custom upload</span><small>Moderation required</small></div></div></div>
        <div className="identity-field"><span>Allegiance</span><div className="allegiance-picker">{ALLEGIANCES.map((allegiance) => <button type="button" className={form.allegiance === allegiance ? "active" : ""} key={allegiance} onClick={() => setForm({ ...form, allegiance })}><img src={ALLEGIANCE_ART[allegiance]} alt="" /><span>{allegiance}</span></button>)}</div></div>
        <div className="identity-select-row"><label><span>Region</span><select value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })}>{REGIONS.map((region) => <option key={region}>{region}</option>)}</select></label><label><span>Favorite Mystic</span><select value={form.favoriteMysticId ?? ""} onChange={(event) => setForm({ ...form, favoriteMysticId: event.target.value || null })}><option value="">Not selected</option>{ownedMystics.map((mystic) => <option key={mystic.id} value={mystic.id}>{mystic.name}</option>)}</select></label></div>
        {message ? <p className={`identity-message ${availability === "available" || message.includes("saved") ? "success" : ""}`} role="status">{message}</p> : null}
        <button className="button primary" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Check />}{saving ? "Saving…" : "Save profile"}</button>
      </form> : null}
    </div>
  </div>;
}
