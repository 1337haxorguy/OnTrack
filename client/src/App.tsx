import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import GoalsOverview from "./pages/GoalsOverview";
import CreateGoal from "./pages/CreateGoal";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import Today from "./pages/Today";
import Recap from "./pages/Recap";
import TestGenerate from "./pages/TestGenerate";
import Landing from "./pages/Landing";
import { useApp } from "./context/AppContext";

const NAV_LINKS = [
  { to: "/", label: "Goals" },
  { to: "/today", label: "Today" },
  { to: "/calendar", label: "Calendar" },
  { to: "/recap", label: "Recap" },
  { to: "/profile", label: "Schedule" },
];

// Redirects to "/" if not authenticated
function ProtectedRoute({ element }: { element: React.ReactElement }) {
  const { isAuthenticated, isLoading } = useAuth0();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return element;
}

function App() {
  const { user, isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
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
            <button onClick={() => loginWithRedirect()} className="text-sm text-black/40 hover:text-black transition-colors">
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
      </div>
    );
  }

  const userInitials = user
    ? (user.name || user.email || "?")
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
    <div className="min-h-screen text-white">
      {/* Sticky nav */}
      <nav className="border-b border-white/6 bg-black/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-13">

          {/* Left: logo + nav links */}
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold tracking-wide text-white/90 hover:text-white transition-colors">
              OnTrack
            </Link>

            {isAuthenticated && (
              <div className="flex items-center">
                {NAV_LINKS.map(({ to, label }) => {
                  const active = location.pathname === to ||
                    (to === "/" && location.pathname.startsWith("/goals"));
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`relative px-3 py-4 text-sm transition-colors ${
                        active ? "text-white" : "text-gray-500 hover:text-gray-200"
                      }`}
                    >
                      {label}
                      {active && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-indigo-500 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: user */}
          <div className="flex items-center gap-3">
            {isLoading ? null : isAuthenticated && user ? (
              <Link
                to="/account"
                title={user.name || user.email}
                className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-semibold text-white select-none transition-opacity hover:opacity-80 shrink-0 ${
                  !avatar ? (location.pathname === "/account" ? "bg-indigo-500" : "bg-indigo-600/80") : ""
                }`}
              >
                {avatar
                  ? <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                  : userInitials
                }
              </Link>
            ) : (
              <button
                onClick={() => loginWithRedirect()}
                className="px-3 py-1.5 text-sm bg-white text-black rounded-full hover:bg-gray-100 transition-colors font-medium"
              >
                Sign up
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
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

      {/* Global toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/40 text-sm text-white animate-in">
          <span className="text-gray-200">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { navigate(toast.action!.href); dismissToast(); }}
              className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-medium transition-colors"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={dismissToast}
            className="shrink-0 text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
