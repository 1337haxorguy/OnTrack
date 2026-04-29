import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApp, FREE_LIMITS } from "../context/AppContext";

const API_BASE = import.meta.env.VITE_API_BASE;

async function resizeToBase64(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function DangerRow({
  label,
  sub,
  confirmLabel,
  confirmDesc,
  onConfirm,
}: {
  label: string;
  sub: string;
  confirmLabel: string;
  confirmDesc: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="px-5 py-4 bg-red-50">
        <p className="text-[13px] text-red-800 leading-snug mb-3">{confirmDesc}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onConfirm(); setOpen(false); }}
            className="px-4 py-1.5 text-[12px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-[12px] font-medium text-black/40 hover:text-black transition-colors"
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/[0.05] transition-colors group"
    >
      <div>
        <p className="text-[14px] font-medium text-black/60 group-hover:text-red-600 transition-colors leading-tight">
          {label}
        </p>
        <p className="text-[12px] text-black/40 mt-0.5">{sub}</p>
      </div>
      <svg
        className="w-3.5 h-3.5 text-black/25 group-hover:text-red-300 transition-colors shrink-0 ml-4"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40 mb-2 px-0.5">
      {children}
    </p>
  );
}

const group = "bg-white rounded-2xl border border-black/8 overflow-hidden divide-y divide-black/[0.05]";

export default function Account() {
  const { user, signOut, getToken } = useAuth();
  const { setGoals, setPlan, avatar, setAvatar, subscriptionStatus } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/stripe/create-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  };

  const isPro = subscriptionStatus === "active";

  const displayName = user?.user_metadata?.full_name as string | undefined;
  const email = user?.email as string | undefined;

  const initials = (displayName || email || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await resizeToBase64(file);
      setAvatar(base64);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className="pb-24 w-full"
      style={{ fontFamily: "Epilogue, system-ui, -apple-system, sans-serif" }}
    >
      <h1 className="text-[28px] font-extrabold text-black tracking-[-0.02em] mb-8">
        account
      </h1>

      {/* ── Two-column grid on lg+, stacked on mobile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

        {/* ── LEFT: Profile card ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-black/8 p-6 flex flex-col items-center text-center gap-4">

            {/* Avatar */}
            <div className="relative group">
              <div
                className="w-24 h-24 rounded-full overflow-hidden bg-black flex items-center justify-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white select-none">{initials}</span>
                )}
              </div>

              {/* Camera badge */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Change photo"
                className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-white border border-black/[0.12] shadow-sm flex items-center justify-center hover:bg-black/[0.05] transition-colors disabled:cursor-wait"
              >
                {uploading ? (
                  <div className="w-3.5 h-3.5 border-[1.5px] border-black/20 border-t-black/60 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 text-black/40" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Identity */}
            <div className="flex flex-col gap-0.5 w-full min-w-0">
              {displayName && (
                <p className="text-[16px] font-semibold text-black truncate leading-tight">
                  {displayName}
                </p>
              )}
              {email && (
                <p className="text-[13px] text-black/40 truncate">{email}</p>
              )}
              <p className="text-[11px] text-black/25 mt-1">managed by your login provider</p>
            </div>

            {/* Photo action */}
            {avatar ? (
              <button
                onClick={() => setAvatar(null)}
                className="text-[12px] text-black/40 hover:text-red-500 transition-colors -mt-1"
              >
                remove photo
              </button>
            ) : null}
          </div>

          {/* ── Sign out (bottom of left col on desktop) ── */}
          <div className={group}>
            <button
              onClick={async () => {
                setSigningOut(true);
                setGoals([]);
                setPlan(null);
                setAvatar(null);
                await signOut();
              }}
              disabled={signingOut}
              className="w-full flex items-center justify-between px-5 py-4 text-left group hover:bg-red-50/70 transition-colors disabled:opacity-50"
            >
              <p className="text-[14px] font-medium text-red-500 group-hover:text-red-600 transition-colors">
                {signingOut ? "signing out…" : "sign out"}
              </p>
              {signingOut ? (
                <div className="w-3.5 h-3.5 border-[1.5px] border-red-300 border-t-red-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5 text-red-300 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Settings ── */}
        <div className="flex flex-col gap-6">

          {/* Plan */}
          <div>
            <SectionHead>plan</SectionHead>
            <div className={group}>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold text-black leading-tight">
                    {isPro ? "ontrack pro" : "free plan"}
                  </p>
                  <p className="text-[13px] text-black/40 mt-0.5">
                    {isPro ? "unlimited generations" : `${FREE_LIMITS.generations} generations included`}
                  </p>
                </div>
                {isPro ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] bg-[#E8F1EC] text-[#1F5E46] shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D5E]" />
                    pro
                  </span>
                ) : (
                  <Link
                    to="/upgrade"
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white bg-[#2F7D5E] hover:bg-[#1F5E46] transition-colors"
                  >
                    upgrade →
                  </Link>
                )}
              </div>

              {isPro && (
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-black/[0.05] transition-colors group disabled:opacity-50"
                >
                  <p className="text-[14px] font-medium text-black/60">manage billing</p>
                  {portalLoading ? (
                    <div className="w-3.5 h-3.5 border-[1.5px] border-black/20 border-t-black/50 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5 text-black/25 group-hover:text-black/50 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Data */}
          <div>
            <SectionHead>data</SectionHead>
            <div className={group}>
              <DangerRow
                label="Clear current plan"
                sub="Keeps your goals and schedule intact"
                confirmLabel="Clear plan"
                confirmDesc="your generated plan will be deleted. goals and availability won't be affected."
                onConfirm={() => setPlan(null)}
              />
              <DangerRow
                label="Clear all goals"
                sub="Permanently removes every goal"
                confirmLabel="Clear goals"
                confirmDesc="all goals will be permanently deleted. this cannot be undone."
                onConfirm={() => setGoals([])}
              />
              <DangerRow
                label="Clear everything"
                sub="Goals, plan, and all data"
                confirmLabel="Clear all"
                confirmDesc="all goals and your current plan will be permanently deleted."
                onConfirm={() => { setGoals([]); setPlan(null); }}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
