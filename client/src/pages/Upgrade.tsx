import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { FREE_LIMITS } from "../context/AppContext";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Upgrade() {
  const { isAuthenticated, getToken, openAuthModal } = useAuth();
  const { subscriptionStatus } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPro = subscriptionStatus === "active";

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not start checkout.");
      const { url } = await res.json();
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto pt-8 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 text-sm text-black/40 hover:text-black transition-colors flex items-center gap-1.5"
      >
        ← back
      </button>

      <h1 className="text-3xl font-extrabold text-black tracking-tight mb-1">OnTrack Pro</h1>
      <p className="text-black/50 text-sm mb-8">Unlimited generations, forever.</p>

      <div className="rounded-2xl border border-black/8 bg-white shadow-sm overflow-hidden mb-5">

        {/* Price header */}
        <div className="px-6 py-6 border-b border-black/6">
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-extrabold text-black tracking-tight">$2</span>
            <span className="text-black/40 text-sm mb-1.5">/ month</span>
          </div>
          <p className="text-xs text-black/40 mt-1">Cancel anytime. No contracts.</p>
        </div>

        {/* Feature list */}
        <div className="px-6 py-5 flex flex-col gap-3.5">
          {[
            { label: "Unlimited plan generations",     detail: `vs. ${FREE_LIMITS.generations} on free` },
            { label: "Unlimited daily regenerations",  detail: "regen as often as you want" },
            { label: "Unlimited goal regenerations",   detail: "per-goal regen, no cap" },
            { label: "Up to 5 active goals",           detail: "same on free" },
          ].map(({ label, detail }) => (
            <div key={label} className="flex items-start gap-3">
              <span
                className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "#E8F1EC" }}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#2F7D5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-black leading-tight">{label}</p>
                <p className="text-xs text-black/40">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          {isPro ? (
            <div className="w-full px-4 py-3 rounded-full text-center text-sm font-semibold text-[#1F5E46] bg-[#E8F1EC]">
              You're on Pro ✓
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full px-4 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              style={{ background: "#2F7D5E" }}
            >
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? "Redirecting to checkout…" : "Upgrade to Pro →"}
            </button>
          )}
          {error && <p className="mt-2 text-xs text-red-500 text-center">{error}</p>}
        </div>
      </div>

      <p className="text-xs text-black/30 text-center leading-relaxed">
        Payments are processed securely by Stripe.
        <br />
        You can manage or cancel your subscription at any time from your account page.
      </p>
    </div>
  );
}
