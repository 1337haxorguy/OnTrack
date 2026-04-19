import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function AuthModal() {
  const { authModal, closeAuthModal } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(authModal.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Sync mode + reset form when modal opens
  useEffect(() => {
    if (authModal.isOpen) {
      setMode(authModal.mode);
      setError(null);
      setDone(false);
    }
  }, [authModal.isOpen, authModal.mode]);

  if (!authModal.isOpen) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setLoading(false);
    setDone(false);
  };

  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    setError(null);
    setDone(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setDone(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange in AuthContext closes modal automatically
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) { closeAuthModal(); reset(); } }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-black">
              {mode === "signup" ? "create account" : "welcome back"}
            </h2>
            <p className="text-sm text-black/40 mt-0.5">
              {mode === "signup" ? "start building your goals." : "sign in to continue."}
            </p>
          </div>
          <button
            onClick={() => { closeAuthModal(); reset(); }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/5 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Confirmation state (signup) */}
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-xl">
              ✓
            </div>
            <p className="text-sm font-medium text-black">check your email</p>
            <p className="text-sm text-black/40">
              we sent a confirmation link to <strong className="text-black/60">{email}</strong>.
              click it to activate your account.
            </p>
            <button
              onClick={() => { switchMode("signin"); setDone(false); }}
              className="mt-2 text-sm text-black/50 hover:text-black transition-colors"
            >
              already confirmed? sign in →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-black/50">email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-black placeholder:text-black/25 text-sm focus:outline-none focus:border-black/30 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-black/50">password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-black placeholder:text-black/25 text-sm focus:outline-none focus:border-black/30 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black hover:bg-black/80 text-white text-sm font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                mode === "signup" ? "create account" : "sign in"
              )}
            </button>
          </form>
        )}

        {/* Footer toggle */}
        {!done && (
          <p className="text-center text-xs text-black/35">
            {mode === "signup" ? "already have an account? " : "don't have an account? "}
            <button
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              className="text-black font-medium hover:underline"
            >
              {mode === "signup" ? "sign in" : "sign up"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
