"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { LOGO_ART } from "@/lib/art";
import { getSupabaseClient } from "@/lib/supabase";

export function ResetPasswordView() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void getSupabaseClient().auth.getSession().then(({ data }) => {
      if (active) setSessionReady(Boolean(data.session));
    });
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      if (active) setSessionReady(Boolean(session));
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) { setMessage("Password must contain at least 8 characters."); return; }
    setBusy(true);
    setMessage("");
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    setMessage("Password updated. Returning to Mini Mystics…");
    window.setTimeout(() => router.replace("/game"), 500);
  };

  return <main className="auth-page">
    <div className="auth-scene-shade" />
    <div className="auth-portal-glow" aria-hidden="true" />
    <div className="auth-stage">
      <section className="auth-card" aria-labelledby="reset-title">
        <div className="auth-logo"><img src={LOGO_ART} alt="Mini Mystics" /></div>
        <div className="auth-heading"><span>ACCOUNT RECOVERY</span><h1 id="reset-title">Choose a New Password</h1><p>Restore access to your Handler archive.</p></div>
        {!sessionReady ? <div className="auth-error" role="alert">This reset link is invalid or has expired. Request a new link from the login screen.</div> : <form onSubmit={submit}>
          <label className="auth-field" htmlFor="reset-password"><span>New password</span><span className="auth-password-field"><input id="reset-password" type={visible ? "text" : "password"} value={password} placeholder="8+ characters" autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff /> : <Eye />}</button></span></label>
          {message ? <div className="auth-error" role="status">{message}</div> : null}
          <button className="auth-enter-button" type="submit" disabled={busy}>{busy ? "UPDATING…" : <>UPDATE PASSWORD<ArrowRight /></>}</button>
        </form>}
      </section>
    </div>
  </main>;
}
