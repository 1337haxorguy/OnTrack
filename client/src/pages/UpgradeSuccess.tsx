import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function UpgradeSuccess() {
  useEffect(() => { document.title = "Welcome to Pro — OnTrack"; }, []);

  return (
    <div className="max-w-sm mx-auto pt-16 pb-24 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ background: "#E8F1EC" }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M5 14L11 20L23 8" stroke="#2F7D5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="text-2xl font-extrabold text-black tracking-tight mb-2">You're on Pro.</h1>
      <p className="text-sm text-black/50 leading-relaxed mb-8 max-w-xs mx-auto">
        Unlimited generations, starting now. Go build something.
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-colors inline-block"
        style={{ background: "#2F7D5E" }}
      >
        Go to my goals →
      </Link>
    </div>
  );
}
