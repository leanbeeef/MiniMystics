"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Archive, Backpack, Bell, BookOpen, Boxes, ChevronLeft, ChevronRight, Coins, House, Layers3, LogOut, Menu, ScrollText, Settings, ShoppingBag, Swords, Trophy, UserRound, UsersRound, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useGame } from "./game-provider";
import { DashboardView, CollectionView, LoadoutsView, CampaignView, PacksView, OpeningView, InventoryView, BindersView, ComingSoonView, BattleView, SettingsView } from "./views";
import { LOGO_ART } from "@/lib/art";
import { xpForLevel } from "@/lib/game/rewards";
import { ComicsLibraryPage } from "./comics/comics-library-page";
import { ProfileView } from "./profile-view";
import { FriendsView } from "./friends-view";
import { optimizedAsset } from "@/lib/asset-url";

const nav = [
  { href: "game", label: "Dashboard", icon: House },
  { href: "battle", label: "Battle", icon: Swords },
  { href: "campaign", label: "Campaign", icon: ScrollText },
  { href: "collection", label: "Collection", icon: Layers3 },
  { href: "collections", label: "Binders", icon: Archive },
  { href: "loadouts", label: "Loadouts", icon: Boxes },
  { href: "packs", label: "Packs", icon: ShoppingBag },
  { href: "inventory", label: "Inventory", icon: Backpack },
  { href: "comics", label: "Comics", icon: BookOpen },
  { href: "profile", label: "Profile", icon: UserRound },
  { href: "friends", label: "Friends", icon: UsersRound },
  { href: "marketplace", label: "Marketplace", icon: Trophy, soon: true },
  { href: "trading", label: "Trading", icon: UsersRound, soon: true },
  { href: "settings", label: "Settings", icon: Settings },
] as const;

export function GameShell({ view }: { view: string }) {
  const { state, ready, logout, error } = useGame();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (ready && !state.account) router.replace("/");
    setCollapsed(localStorage.getItem("mini-mystics.nav-collapsed") === "true");
  }, [ready, state.account, router]);

  const toggleCollapsed = () => setCollapsed((current) => {
    localStorage.setItem("mini-mystics.nav-collapsed", String(!current));
    return !current;
  });

  const pageTitle = useMemo(() => nav.find((item) => item.href === view)?.label ?? (view === "open" ? "Pack Opening" : "Dashboard"), [view]);
  if (!ready || !state.account) return <main className="loading-screen"><div className="celestial-loader"><span /></div><p>Preparing your archive…</p></main>;

  const content = (() => {
    switch (view) {
      case "game": return <DashboardView />;
      case "collection": return <CollectionView />;
      case "collections": return <BindersView />;
      case "loadouts": return <LoadoutsView />;
      case "campaign": return <CampaignView />;
      case "battle": return <BattleView />;
      case "packs": return <PacksView />;
      case "open": return <OpeningView />;
      case "inventory": return <InventoryView />;
      case "comics": return <ComicsLibraryPage />;
      case "profile": return <ProfileView />;
      case "friends": return <FriendsView />;
      case "marketplace": return <ComingSoonView kind="Marketplace" />;
      case "trading": return <ComingSoonView kind="Trading" />;
      case "settings": return <SettingsView />;
      default: return <DashboardView />;
    }
  })();

  const levelTarget = xpForLevel(state.level);
  const xpPercent = Math.min(100, Math.round(state.xp / levelTarget * 100));

  return (
    <div className={`app-shell ${collapsed ? "nav-collapsed" : ""}`}>
      {mobileOpen ? <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img className="sidebar-logo" src={LOGO_ART} alt="Mini Mystics" />
          <button className="icon-button close-nav" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button>
        </div>
        <nav aria-label="Primary navigation">{nav.map(({ href, label, icon: Icon, ...item }) => <Link key={href} href={`/${href}`} title={collapsed ? label : undefined} aria-current={pathname === `/${href}` ? "page" : undefined} className={pathname === `/${href}` ? "active" : ""} onClick={() => setMobileOpen(false)}><Icon /><span>{label}</span>{"soon" in item && item.soon ? <small>SOON</small> : null}</Link>)}</nav>
        <div className="sidebar-footer">
          <button className="collapse-nav" onClick={toggleCollapsed} title={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <ChevronRight /> : <ChevronLeft />}<span>{collapsed ? "Expand" : "Collapse"}</span></button>
          <button className="logout" onClick={logout} title="Log out"><LogOut /><span>Log out</span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div className="page-identity"><span>THE FIRST CONVERGENCE</span><strong>{pageTitle}</strong></div>
          <div className="top-resources">
            <div className="level-counter"><span>LEVEL {state.level}</span><div className="top-xp-track"><i style={{ width: `${xpPercent}%` }} /></div><small>{state.xp} / {levelTarget} XP</small></div>
            <div className="resource-counter" title="Coin balance"><Coins /><strong>{state.coins.toLocaleString()}</strong></div>
            {state.activeBoosts.xp ? <div className="top-boost xp"><Zap /><span><strong>2× XP</strong><small>{state.activeBoosts.xp.matches} matches</small></span></div> : null}
            {state.activeBoosts.coins ? <div className="top-boost coins"><Coins /><span><strong>2× Coins</strong><small>{state.activeBoosts.coins.matches} matches</small></span></div> : null}
            <button className="icon-button notifications" title="Notifications" aria-label="Notifications"><Bell /></button>
            <Link href="/profile" className="profile-chip" title="Profile"><span className="avatar">{state.profile?.avatarPath ? <img src={optimizedAsset(state.profile.avatarPath) ?? state.profile.avatarPath} alt="" decoding="async" /> : state.account.username.slice(0, 2).toUpperCase()}</span><span><strong>{state.profile?.handlerName ?? state.account.username}</strong><small>Handler</small></span></Link>
          </div>
        </header>
        {error ? <div className="toast-error" role="alert">{error}</div> : null}
        <div className="page-transition" key={pathname}>{content}</div>
      </main>
    </div>
  );
}
