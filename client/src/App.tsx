import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import GoalsOverview from "./pages/GoalsOverview";
import CreateGoal from "./pages/CreateGoal";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import Today from "./pages/Today";
import TestGenerate from "./pages/TestGenerate";
import Landing from "./pages/Landing";
import { useApp } from "./context/AppContext";

const NAV_LINKS = [
  { to: "/", label: "Goals" },
  { to: "/today", label: "Today" },
  { to: "/calendar", label: "Calendar" },
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
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const { dataLoaded, avatar } = useApp();
  const location = useLocation();

  // Content to render inside <main> for the "/" route
  const homeElement = () => {
    if (isLoading) return null;
    if (!isAuthenticated) return <Landing />;
    if (!dataLoaded) return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
    return <GoalsOverview />;
  };

  const userInitials = user
    ? (user.name || user.email || "?")
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  return (
    <div className="min-h-screen text-white">
      {/* Sticky nav */}
      <nav className="border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-md sticky top-0 z-10">
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
                className="px-3 py-1.5 text-sm bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={homeElement()} />
          <Route path="/goals/new" element={<ProtectedRoute element={dataLoaded ? <CreateGoal /> : <></>} />} />
          <Route path="/goals/:id"  element={<ProtectedRoute element={dataLoaded ? <CreateGoal /> : <></>} />} />
          <Route path="/today"      element={<ProtectedRoute element={dataLoaded ? <Today />    : <></>} />} />
          <Route path="/calendar"   element={<ProtectedRoute element={dataLoaded ? <Calendar />  : <></>} />} />
          <Route path="/profile"    element={<ProtectedRoute element={dataLoaded ? <Profile />   : <></>} />} />
          <Route path="/account"    element={<ProtectedRoute element={<Account />} />} />
          <Route path="/test"       element={<ProtectedRoute element={<TestGenerate />} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
