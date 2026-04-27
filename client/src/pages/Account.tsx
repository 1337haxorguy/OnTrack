import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

const cardCls = "rounded-2xl border border-black/8 bg-white shadow-sm p-5 flex flex-col gap-4";

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
        // Center-crop to square before scaling
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

function DangerButton({
  label,
  confirmLabel,
  description,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
        <p className="text-sm text-red-700 flex-1">{description}</p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { onConfirm(); setConfirming(false); }}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors font-medium"
          >
            {confirmLabel}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-black/8 hover:border-red-200 hover:bg-red-50 text-left transition-colors group"
    >
      <span className="text-sm text-black/70 group-hover:text-red-700 transition-colors">{label}</span>
      <span className="text-xs text-black/25 group-hover:text-red-500 transition-colors">Remove</span>
    </button>
  );
}

export default function Account() {
  const { user, signOut } = useAuth();
  const { setGoals, setPlan, avatar, setAvatar } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = user
    ? (user.user_metadata?.full_name || user.email || "?")
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await resizeToBase64(file);
      setAvatar(base64);
    } finally {
      setUploading(false);
      // Reset so the same file can be re-selected
      e.target.value = "";
    }
  };

  return (
    <div className="max-w-lg pb-20">
      <h1 className="text-xl font-bold text-black mb-8">Account</h1>

      <div className="flex flex-col gap-4">

        {/* ── PROFILE ── */}
        <section className={cardCls}>
          <h2 className="text-sm font-semibold text-black">Profile</h2>
          <div className="flex items-center gap-4">

            {/* Avatar with upload overlay */}
            <div className="relative shrink-0 group">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-black/80 flex items-center justify-center">
                {avatar ? (
                  <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-white select-none">{initials}</span>
                )}
              </div>

              {/* Upload overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
                aria-label="Change profile picture"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
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

            {/* Name / email */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              {user?.user_metadata?.full_name && (
                <p className="text-base font-medium text-black truncate">{user.user_metadata.full_name}</p>
              )}
              {user?.email && (
                <p className="text-sm text-black/40 truncate">{user.email}</p>
              )}
              <p className="text-xs text-black/25 mt-1">Managed by your login provider</p>
            </div>
          </div>

          {/* Remove photo */}
          {avatar && (
            <button
              onClick={() => setAvatar(null)}
              className="self-start text-xs text-black/40 hover:text-red-500 transition-colors"
            >
              Remove photo
            </button>
          )}
        </section>

        {/* ── DATA ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-black mb-1">Your data</h2>
            <p className="text-xs text-black/40">These actions are permanent and cannot be undone.</p>
          </div>

          <div className="flex flex-col gap-2">
            <DangerButton
              label="Clear current plan"
              confirmLabel="Yes, clear plan"
              description="This will delete your generated plan. Your goals and schedule won't be affected."
              onConfirm={() => setPlan(null)}
            />
            <DangerButton
              label="Clear all goals"
              confirmLabel="Yes, clear goals"
              description="This will permanently delete all your goals."
              onConfirm={() => setGoals([])}
            />
            <DangerButton
              label="Clear everything"
              confirmLabel="Yes, clear all"
              description="This will delete all your goals and your current plan."
              onConfirm={() => { setGoals([]); setPlan(null); }}
            />
          </div>
        </section>

        {/* ── SIGN OUT ── */}
        <section className={cardCls}>
          <h2 className="text-sm font-semibold text-black">Session</h2>
          <button
            onClick={async () => {
              setGoals([]);
              setPlan(null);
              setAvatar(null);
              await signOut();
            }}
            className="w-full px-4 py-2.5 border border-black/10 rounded-full text-sm text-black/60 hover:border-black/20 hover:text-black transition-colors text-left"
          >
            Sign out
          </button>
        </section>

      </div>
    </div>
  );
}
