"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { useGame } from "./game-provider";
import { LOGO_ART } from "@/lib/art";

export function AuthView() {
  const { state, ready, signup, login } = useGame();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  if (!ready) return <main className="auth-page"><div className="loader" /></main>;
  if (state.account) return <main className="auth-page"><a className="button primary" href="/game">Continue as {state.account.username}<ArrowRight /></a></main>;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(""); try { if (mode === "signup") await signup(email, username, password); else await login(email, password); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not continue"); } finally { setBusy(false); } };
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand-lockup graphic-logo"><img src={LOGO_ART} alt="Mini Mystics" /></div>
        <div className="intro-copy"><span className="eyebrow">ENTER THE CONVERGENCE</span><h1>Small cards.<br /><em>Big decisions.</em></h1><p>Build a lineup from ten rival Orders. Read the roll. Break the defense. Take your next card home.</p></div>
        <div className="order-orbit" aria-hidden="true"><span>✦</span><span>◈</span><span>✺</span><span>◇</span><span>✧</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="step-label">{mode === "signup" ? "NEW HANDLER" : "RETURNING HANDLER"}</span>
          <h2>{mode === "signup" ? "Claim your starter pack" : "Welcome back"}</h2>
          <p>{mode === "signup" ? "Create an account and reveal 10 cards immediately." : "Your collection is waiting."}</p>
          <div className="segmented"><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button></div>
          <form onSubmit={submit}>
            {mode === "signup" ? <label>Handler name<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your public name" autoComplete="username" /></label> : null}
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} /><button type="button" aria-label="Show password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
            {message ? <p className="form-error">{message}</p> : null}
            <button className="button primary wide" disabled={busy}>{busy ? "Opening the gate…" : mode === "signup" ? "Create & get starter pack" : "Enter your collection"}<ArrowRight /></button>
          </form>
          <div className="oauth-row"><button disabled>Google <small>Setup required</small></button><button disabled>Apple <small>Setup required</small></button></div>
          <p className="auth-note">Local prototype accounts are stored on this device. Production PostgreSQL and provider variables are documented in the project setup.</p>
        </div>
      </section>
    </main>
  );
}
