import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import GoalsOverview from "./pages/GoalsOverview";
import CreateGoal from "./pages/CreateGoal";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import TestGenerate from "./pages/TestGenerate";

const NAV_LINKS = [
  { to: "/", label: "Goals" },
  { to: "/calendar", label: "Calendar" },
  { to: "/profile", label: "Schedule" },
];

function App() {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const location = useLocation();

  return (
    <div className="min-h-screen text-white">
      {/* Sticky nav */}
      <nav className="border-b border-gray-800 bg-gray-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-5">
            <Link to="/" className="text-base font-bold tracking-tight text-white">
              OnTrack
            </Link>
            <div className="flex gap-0.5">
              {NAV_LINKS.map(({ to, label }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-3 py-1.5 text-sm rounded transition-colors ${
                      active
                        ? "text-white bg-gray-800"
                        : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLoading ? null : isAuthenticated && user ? (
              <>
                <span className="text-sm text-gray-400 hidden sm:block">{user.name || user.email}</span>
                <button
                  onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                  className="px-3 py-1.5 text-sm border border-gray-700 rounded hover:bg-gray-800 transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={() => loginWithRedirect()}
                className="px-3 py-1.5 text-sm bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
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
          <Route path="/" element={<GoalsOverview />} />
          <Route path="/goals/new" element={<CreateGoal />} />
          <Route path="/goals/:id" element={<CreateGoal />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/test" element={<TestGenerate />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
