import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import CurvedWordmark from "./components/CurvedWordmark";
import GoalsOverview from "./pages/GoalsOverview";
import CreateGoal from "./pages/CreateGoal";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import Today from "./pages/Today";
import Recap from "./pages/Recap";
import Upgrade from "./pages/Upgrade";
import UpgradeSuccess from "./pages/UpgradeSuccess";
import UpgradeCancel from "./pages/UpgradeCancel";
import TestGenerate from "./pages/TestGenerate";
import Landing from "./pages/Landing";
import AuthModal from "./components/AuthModal";
import { useApp, FREE_LIMITS } from "./context/AppContext";
import { useAuth } from "./context/AuthContext";

const NAV_LINKS = [
  { to: "/",         label: "Goals",    dataTour: "nav-goals"    },
  { to: "/today",    label: "Today",    dataTour: "nav-today"    },
  { to: "/calendar", label: "Calendar", dataTour: "nav-calendar" },
  { to: "/recap",    label: "Recap",    dataTour: undefined      },
  { to: "/profile",  label: "Schedule", dataTour: "nav-schedule" },
];

// Redirects to "/" if not authenticated
function ProtectedRoute({ element }: { element: React.ReactElement }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return element;
}

function App() {
  const { user, isAuthenticated, isLoading, openAuthModal } = useAuth();
  const { dataLoaded, avatar, toast, dismissToast, goals, usage, limitsEnabled, unlimited } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Full-page cream routes (outside dark nav wrapper) ──────────────────────
  const onHome      = location.pathname === "/";
  const onNewGoal   = location.pathname === "/goals/new";
  const isGuest     = !isAuthenticated && goals.length === 0;

  // Landing
  if (onHome && (isLoading || isGuest)) {
    if (isLoading) return <div className="min-h-screen bg-[#F9F9F9]" />;
    return <Landing />;
  }

  // Goal creation — CreateGoal renders its own topbar and full-page layout
  if (onNewGoal) {
    if (isLoading || !dataLoaded) return <div className="min-h-screen bg-[#F9F9F9]" />;
    return (
      <div className="min-h-screen bg-[#F9F9F9] text-black">
        <CreateGoal />
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-black/10 bg-white shadow-xl text-sm text-black">
            <span>{toast.message}</span>
            {toast.action && (
              <button onClick={() => { navigate(toast.action!.href); dismissToast(); }}
                className="shrink-0 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-full hover:bg-black/80 transition-colors">
                {toast.action.label}
              </button>
            )}
            <button onClick={dismissToast} className="shrink-0 text-black/30 hover:text-black text-lg leading-none">✕</button>
          </div>
        )}
        <AuthModal />
      </div>
    );
  }

  const userInitials = user
    ? (user.user_metadata?.full_name || user.email || "?")
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  // Home element for authenticated users or guests who already made a goal
  const homeElement = () => {
    if (!dataLoaded) return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
    return <GoalsOverview />;
  };

  return (
    <div className="min-h-screen text-black">
      {/* Sticky nav */}
      <nav className="border-b border-black/[0.08] bg-[#F9F9F9]/92 backdrop-blur-[10px] sticky top-0 z-10" style={{ backdropFilter: "saturate(1.2) blur(10px)" }}>
        <div className="max-w-[1180px] mx-auto px-7 flex items-center justify-between h-16">

          {/* Left: wordmark */}
          <Link to="/" className="select-none shrink-0 text-black hover:text-black/70 transition-colors">
            <CurvedWordmark scale={0.52} />
          </Link>

          {/* Center: pill tab group */}
          {!isGuest && (
            <div className="absolute left-1/2 -translate-x-1/2 inline-flex gap-0.5 rounded-full p-1" style={{ background: "rgba(13,13,13,0.05)" }}>
              {NAV_LINKS.map(({ to, label, dataTour }) => {
                const active = location.pathname === to ||
                  (to === "/" && location.pathname.startsWith("/goals"));
                return (
                  <Link
                    key={to}
                    to={to}
                    {...(dataTour ? { "data-tour": dataTour } : {})}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-150 ${
                      active
                        ? "bg-black text-white"
                        : "text-black/60 hover:text-black"
                    }`}
                  >
                    {active && (
                      <span className="w-[5px] h-[5px] rounded-full bg-current shrink-0" style={{ opacity: 0.7 }} />
                    )}
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right: user */}
          <div className="flex items-center gap-3 shrink-0">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-black/5 animate-pulse" />
            ) : isAuthenticated && user ? (
              <Link
                to="/account"
                title={user.user_metadata?.full_name || user.email}
                className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[12px] font-bold text-white select-none transition-all hover:opacity-75 hover:scale-105 shrink-0 ring-2 ring-transparent hover:ring-black/10 ${
                  !avatar ? "bg-black" : ""
                }`}
              >
                {avatar
                  ? <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                  : userInitials
                }
              </Link>
            ) : (
              <button
                onClick={() => openAuthModal("signup")}
                className="px-4 py-2 text-[13px] font-semibold bg-black text-white rounded-full hover:bg-black/85 transition-colors"
              >
                Sign up
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Upgrade banner — shown when free user hits generation limit */}
      {limitsEnabled && isAuthenticated && !unlimited && usage.generations >= FREE_LIMITS.generations && (
        <div className="border-b border-black/6 bg-white">
          <div className="max-w-[1180px] mx-auto px-7 py-2.5 flex items-center justify-between gap-4">
            <p className="text-xs text-black/50">
              You've used all <span className="font-semibold text-black">{FREE_LIMITS.generations}</span> free generations.
            </p>
            <Link
              to="/upgrade"
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white transition-colors"
              style={{ background: "#2F7D5E" }}
            >
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="max-w-[1180px] mx-auto px-7 pt-9 pb-[120px]">
        <Routes>
          <Route path="/" element={homeElement()} />
          {/* /goals/new is handled by the cream early-return above — no route needed here */}
          <Route path="/goals/:id"  element={<ProtectedRoute element={dataLoaded ? <CreateGoal /> : <></>} />} />
          <Route path="/today"      element={<ProtectedRoute element={dataLoaded ? <Today />    : <></>} />} />
          <Route path="/calendar"   element={dataLoaded ? <Calendar /> : <></>} />
          <Route path="/profile"    element={<ProtectedRoute element={dataLoaded ? <Profile />   : <></>} />} />
          <Route path="/recap"      element={<ProtectedRoute element={dataLoaded ? <Recap /> : <></>} />} />
          <Route path="/account"         element={<ProtectedRoute element={<Account />} />} />
          <Route path="/upgrade"         element={<Upgrade />} />
          <Route path="/upgrade/success" element={<UpgradeSuccess />} />
          <Route path="/upgrade/cancel"  element={<UpgradeCancel />} />
          <Route path="/test"            element={<ProtectedRoute element={<TestGenerate />} />} />
        </Routes>
      </main>

      {/* Auth modal */}
      <AuthModal />

      {/* Global toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-black/10 bg-white shadow-xl text-sm text-black animate-in">
          <span className="text-black/70">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { navigate(toast.action!.href); dismissToast(); }}
              className="shrink-0 px-3 py-1.5 bg-black hover:bg-black/80 rounded-full text-white text-xs font-medium transition-colors"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={dismissToast}
            className="shrink-0 text-black/25 hover:text-black transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
