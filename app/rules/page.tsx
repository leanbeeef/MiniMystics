"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GameShell } from "@/components/game-shell";
import { useGame } from "@/components/game-provider";
import { RulesView } from "@/components/rules-view";
import { LOGO_ART } from "@/lib/art";

export default function RulesPage() {
  const { state, ready } = useGame();
  if (!ready) return <main className="loading-screen"><div className="celestial-loader"><span /></div><p>Opening the field guide…</p></main>;
  if (state.account) return <GameShell view="rules" />;
  return <main className="public-rules-shell">
    <header><img src={LOGO_ART} alt="Mini Mystics" /><Link href="/"><ArrowLeft />Sign in or create an account</Link></header>
    <RulesView publicView />
  </main>;
}
