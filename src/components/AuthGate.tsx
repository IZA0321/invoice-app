"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, ALLOWED_EMAILS } from "@/lib/supabase";

// ログイン不要で公開するページ（取引先向けのダウンロード等）
const PUBLIC_PATHS = ["/downloads"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (isPublic) return <>{children}</>;
  if (!ready) return null;
  if (session) return <>{children}</>;

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!ALLOWED_EMAILS.includes(addr)) {
      setMessage("このメールアドレスではログインできません。");
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setMessage(`送信に失敗しました：${error.message}`);
      return;
    }
    setEmail(addr);
    setStep("code");
    setMessage("ログインコードをメールで送りました（数分以内に届きます）。");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMessage("コードが正しくないか、期限切れです。もう一度お試しください。");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
        <h1 className="text-lg font-bold text-slate-800 mb-1">IZA 書類管理</h1>
        <p className="text-sm text-slate-500 mb-5">ログインしてください</p>
        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-900 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
            >
              {busy ? "送信中…" : "ログインコードを送る"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-slate-600">{email} に届いた6桁のコード</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-2xl tracking-widest"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-900 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
            >
              {busy ? "確認中…" : "ログイン"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setMessage("");
              }}
              className="w-full text-sm text-slate-500"
            >
              メールアドレスを変更する
            </button>
          </form>
        )}
        {message && <p className="text-sm text-slate-600 mt-4">{message}</p>}
      </div>
    </div>
  );
}
