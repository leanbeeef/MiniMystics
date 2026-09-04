"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useGame } from "./game-provider";
import { LOGO_ART } from "@/lib/art";
import { validateHandlerName } from "@/lib/player-profile";

type AuthMode = "signup" | "login";
type FieldErrors = Partial<Record<"username" | "email" | "password", string>>;

function MiniMysticsLogo() {
  return <div className="auth-logo"><img src={LOGO_ART} alt="Mini Mystics" /></div>;
}

function FormField({ id, label, type = "text", value, placeholder, autoComplete, error, onChange }: { id: string; label: string; type?: string; value: string; placeholder: string; autoComplete: string; error?: string; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return <label className={`auth-field ${error ? "invalid" : ""}`} htmlFor={id}><span>{label}</span><input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} />{error ? <small id={errorId} role="alert">{error}</small> : null}</label>;
}

function PasswordField({ value, mode, error, visible, onChange, onToggle }: { value: string; mode: AuthMode; error?: string; visible: boolean; onChange: (value: string) => void; onToggle: () => void }) {
  const errorId = "auth-password-error";
  return <label className={`auth-field ${error ? "invalid" : ""}`} htmlFor="auth-password"><span>Password</span><span className="auth-password-field"><input id="auth-password" type={visible ? "text" : "password"} value={value} placeholder="8+ characters" autoComplete={mode === "signup" ? "new-password" : "current-password"} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={onToggle}>{visible ? <EyeOff /> : <Eye />}</button></span>{error ? <small id={errorId} role="alert">{error}</small> : null}</label>;
}

function AuthError({ message }: { message: string }) {
  return message ? <div className="auth-error" role="alert">{message}</div> : null;
}

function AuthButton({ busy }: { busy: boolean }) {
  return <button className="auth-enter-button" type="submit" disabled={busy}>{busy ? <><span className="auth-button-spinner" aria-hidden="true" />ENTERING...</> : <>ENTER MINI MYSTICS<ArrowRight /></>}</button>;
}

function validate(mode: AuthMode, email: string, username: string, password: string) {
  const errors: FieldErrors = {};
  if (mode === "signup") errors.username = validateHandlerName(username) ?? undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  if (password.length < 8) errors.password = "Password must contain at least 8 characters.";
  return errors;
}

function AuthPanel() {
  const { signup, login, loginWithGoogle } = useGame();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const clearError = (field: keyof FieldErrors) => setErrors((current) => ({ ...current, [field]: undefined }));
  const changeMode = (next: AuthMode) => { setMode(next); setErrors({}); setMessage(""); setPassword(""); setShowPassword(false); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validate(mode, email, username, password);
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      if (mode === "signup") await signup(email, username, password);
      else await login(email, password);
      setSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, 380));
      router.push(mode === "signup" ? "/open" : "/game");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not enter Mini Mystics.");
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const isNew = await loginWithGoogle();
      setSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      router.push(isNew ? "/profile" : "/game");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not continue with Google.");
      setBusy(false);
    }
  };

  return <section className={`auth-card ${success ? "success" : ""}`} aria-labelledby="auth-title">
    <MiniMysticsLogo />
    <div className="auth-heading"><span>THE FIRST CONVERGENCE</span><h1 id="auth-title">{mode === "login" ? "Enter the Convergence" : "Join the Convergence"}</h1><p>{mode === "login" ? "Build your collection. Command your Mystics. Shape your legend." : "Choose your Handler name and claim your first cards."}</p></div>
    <form noValidate onSubmit={submit}>
      {mode === "signup" ? <FormField id="auth-username" label="Handler name" value={username} placeholder="Your public name" autoComplete="username" error={errors.username} onChange={(value) => { setUsername(value); clearError("username"); }} /> : null}
      <FormField id="auth-email" label="Email" type="email" value={email} placeholder="you@example.com" autoComplete="email" error={errors.email} onChange={(value) => { setEmail(value); clearError("email"); }} />
      <PasswordField value={password} mode={mode} error={errors.password} visible={showPassword} onChange={(value) => { setPassword(value); clearError("password"); }} onToggle={() => setShowPassword((current) => !current)} />
      <AuthError message={message} />
      <AuthButton busy={busy} />
    </form>
    <div className="auth-divider"><span>OR</span></div>
    <button className="auth-google-button" type="button" disabled={busy} onClick={googleSignIn}><span aria-hidden="true">G</span>Continue with Google</button>
    <button className="auth-mode-switch" type="button" disabled={busy} onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? <>New Handler? <strong>Create your account</strong></> : <>Already a Handler? <strong>Return to login</strong></>}</button>
    <p className="auth-storage-note">Your Handler identity stays with your Mini Mystics account.</p>
  </section>;
}

function AuthenticatedPanel({ username }: { username: string }) {
  return <section className="auth-card auth-return-card"><MiniMysticsLogo /><div className="auth-heading"><span>WELCOME BACK, HANDLER</span><h1>Return to the Convergence</h1><p>Your collection and campaign are waiting.</p></div><a className="auth-enter-button" href="/game">CONTINUE AS {username.toUpperCase()}<ArrowRight /></a></section>;
}

function AuthExperience({ username }: { username?: string }) {
  const [returningSession] = useState(Boolean(username));
  return <main className="auth-page"><div className="auth-scene-shade" /><div className="auth-portal-glow" aria-hidden="true" /><div className="auth-stage">{returningSession && username ? <AuthenticatedPanel username={username} /> : <AuthPanel />}</div><footer className="auth-footer"><span>MINI MYSTICS</span><span aria-hidden="true">✦</span><span>THE FIRST CONVERGENCE</span></footer></main>;
}

export function AuthView() {
  const { state, ready } = useGame();
  if (!ready) return <main className="auth-page"><div className="auth-loading-ring" aria-label="Loading Mini Mystics" /></main>;
  return <AuthExperience username={state.account?.username} />;
}
