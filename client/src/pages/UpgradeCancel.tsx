import { Link } from "react-router-dom";

export default function UpgradeCancel() {
  return (
    <div className="max-w-sm mx-auto pt-16 pb-24 text-center">
      <h1 className="text-2xl font-extrabold text-black tracking-tight mb-2">No worries.</h1>
      <p className="text-sm text-black/50 leading-relaxed mb-8">
        You haven't been charged. Come back whenever you're ready.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          to="/upgrade"
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-colors"
          style={{ background: "#2F7D5E" }}
        >
          See plans
        </Link>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-full text-sm font-semibold text-black/50 border border-black/10 hover:border-black/20 hover:text-black transition-colors"
        >
          Back to goals
        </Link>
      </div>
    </div>
  );
}
