import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Target, Sun, CalendarDays, Clock3, BarChart2 } from "lucide-react";
import GoalsOverview from "./pages/GoalsOverview";
import CreateGoal from "./pages/CreateGoal";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import Today from "./pages/Today";
import Recap from "./pages/Recap";
import TestGenerate from "./pages/TestGenerate";
import Landing from "./pages/Landing";
import OnboardingTour from "./components/OnboardingTour";
import AuthModal from "./components/AuthModal";
import { useApp } from "./context/AppContext";
import { useAuth } from "./context/AuthContext";

const NAV_LINKS = [
  { to: "/",         label: "Goals",    icon: Target,      dataTour: "nav-goals"    },
  { to: "/today",    label: "Today",    icon: Sun,         dataTour: "nav-today"    },
  { to: "/calendar", label: "Calendar", icon: CalendarDays,dataTour: "nav-calendar" },
  { to: "/recap",    label: "Recap",    icon: BarChart2,   dataTour: undefined      },
  { to: "/profile",  label: "Schedule", icon: Clock3,      dataTour: "nav-schedule" },
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
  const { dataLoaded, avatar, toast, dismissToast, goals } = useApp();
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

  // Goal creation — cream wrapper, no dark nav
  if (onNewGoal) {
    if (isLoading || !dataLoaded) return <div className="min-h-screen bg-[#F9F9F9]" />;
    return (
      <div className="min-h-screen bg-[#F9F9F9] text-black flex flex-col">
        <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b border-black/6 shrink-0">
          <Link to="/" className="text-lg font-bold tracking-tight text-black">OnTrack</Link>
          {!isAuthenticated && (
            <button onClick={() => openAuthModal("signin")} className="text-sm text-black/40 hover:text-black transition-colors">
              log in →
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-6 py-6 pb-24">
            <CreateGoal />
          </div>
        </div>
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
      <nav className="border-b border-black/[0.06] bg-[#F9F9F9]/95 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between h-14">

          {/* Left: wordmark */}
          <Link
            to="/"
            className="flex items-center gap-1.5 select-none shrink-0 group"
          >
            <span className="w-6 h-6 rounded-md bg-black flex items-center justify-center shrink-0 group-hover:bg-black/80 transition-colors">
              <Target className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-black group-hover:text-black/70 transition-colors">
              OnTrack
            </span>
          </Link>

          {/* Center: nav links */}
          {!isGuest && (
            <div className="flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
              {NAV_LINKS.map(({ to, label, icon: Icon, dataTour }) => {
                const active = location.pathname === to ||
                  (to === "/" && location.pathname.startsWith("/goals"));
                return (
                  <Link
                    key={to}
                    to={to}
                    {...(dataTour ? { "data-tour": dataTour } : {})}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                      active
                        ? "bg-black text-white"
                        : "text-black/40 hover:text-black hover:bg-black/[0.05]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right: user */}
          <div className="flex items-center gap-3 shrink-0">
            {isLoading ? (
              <div className="w-7 h-7 rounded-full bg-black/5 animate-pulse" />
            ) : isAuthenticated && user ? (
              <Link
                to="/account"
                title={user.user_metadata?.full_name || user.email}
                className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-semibold text-white select-none transition-all hover:opacity-75 hover:scale-105 shrink-0 ring-2 ring-transparent hover:ring-black/10 ${
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
                className="px-3.5 py-1.5 text-sm bg-black text-white rounded-full hover:bg-black/80 transition-colors font-medium"
              >
                Sign up
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-5 py-8">
        <Routes>
          <Route path="/" element={homeElement()} />
          {/* /goals/new is handled by the cream early-return above — no route needed here */}
          <Route path="/goals/:id"  element={<ProtectedRoute element={dataLoaded ? <CreateGoal /> : <></>} />} />
          <Route path="/today"      element={<ProtectedRoute element={dataLoaded ? <Today />    : <></>} />} />
          <Route path="/calendar"   element={dataLoaded ? <Calendar /> : <></>} />
          <Route path="/profile"    element={<ProtectedRoute element={dataLoaded ? <Profile />   : <></>} />} />
          <Route path="/recap"      element={<ProtectedRoute element={dataLoaded ? <Recap /> : <></>} />} />
          <Route path="/account"    element={<ProtectedRoute element={<Account />} />} />
          <Route path="/test"       element={<ProtectedRoute element={<TestGenerate />} />} />
        </Routes>
      </main>

      {/* Onboarding tour */}
      <OnboardingTour />

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
