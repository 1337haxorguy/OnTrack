import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE = import.meta.env.VITE_API_BASE;

export const DAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;

export type Day = (typeof DAYS)[number];

// ---- Types ----

export interface FollowupQuestion {
  question: string;
  user_response: string;
}

export interface Goal {
  id: string;
  title: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  timeframe: { start_date: string; end_date: string };
  restrictions: string[];
  requests: string[];
  additional_context: string;
  followup_questions: FollowupQuestion[];
  hours_per_week: number;
  has_daily_limit: boolean;
  daily_limit_minutes: number;
  selected_days: string[];
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface RecurringBlock {
  id: string;
  label: string;
  days: string[];
  start_time: string;
  end_time: string;
}

export interface SpecificBlock {
  id: string;
  label: string;
  date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
}

export interface Schedule {
  timezone: string;
  free_slots: Record<string, TimeSlot[]>;
  recurring_blocks: RecurringBlock[];
  specific_blocks: SpecificBlock[];
}

export interface Task {
  title: string;
  description: string;
  estimated_minutes: number;
  completed?: boolean;
}

export interface TimeBlock {
  id: string;
  label: string;
  start_time: string | null;
  end_time: string | null;
  tasks: Task[];
}

export interface DayPlan {
  date: string;
  objective: string;
  time_blocks: TimeBlock[];
}

// ---- Defaults ----

const defaultSchedule: Schedule = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  free_slots: Object.fromEntries(DAYS.map((d) => [d, []])),
  recurring_blocks: [],
  specific_blocks: [],
};

// ---- Context ----

interface AppContextType {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  schedule: Schedule;
  setSchedule: React.Dispatch<React.SetStateAction<Schedule>>;
  plan: DayPlan[] | null;
  setPlan: React.Dispatch<React.SetStateAction<DayPlan[] | null>>;
  avatar: string | null;
  setAvatar: React.Dispatch<React.SetStateAction<string | null>>;
  dataLoaded: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule);
  const [plan, setPlan] = useState<DayPlan[] | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Ref so flushToDb always has the latest getAccessTokenSilently without re-creating the function
  const getTokenRef = useRef(getAccessTokenSilently);
  useEffect(() => { getTokenRef.current = getAccessTokenSilently; }, [getAccessTokenSilently]);

  // Debounced DB write
  const syncEnabled = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ goals?: Goal[]; schedule?: Schedule; plan?: DayPlan[] | null; avatar?: string | null }>({});

  const flushToDb = async () => {
    if (!syncEnabled.current || !isAuthenticated) return;
    if (Object.keys(pending.current).length === 0) return;
    try {
      const token = await getTokenRef.current();
      await fetch(`${API_BASE}/api/user-data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(pending.current),
      });
      pending.current = {};
    } catch {
      // sync failure is non-fatal; data remains in memory for the session
    }
  };

  const queueSync = (patch: typeof pending.current) => {
    if (!syncEnabled.current) return;
    Object.assign(pending.current, patch);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(flushToDb, 600);
  };

  // ---- Load from DB when auth is ready ----
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Unauthenticated: just use localStorage, enable sync (no-ops for unauthed)
      syncEnabled.current = true;
      setDataLoaded(true);
      return;
    }

    (async () => {
      let dbHadSchedule = false;
      try {
        const token = await getAccessTokenSilently();
        const res = await fetch(`${API_BASE}/api/user-data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // DB wins over in-memory defaults when it has data
          if (data.goals?.length > 0) setGoals(data.goals);
          if (data.schedule)          { setSchedule(data.schedule); dbHadSchedule = true; }
          if (data.plan?.length > 0)  setPlan(data.plan);
          if (data.avatar)            setAvatar(data.avatar);
        }
      } catch (e) {
        console.warn("Could not load user data from DB:", e);
      } finally {
        setDataLoaded(true);
        setTimeout(() => {
          syncEnabled.current = true;
          // If the DB had no schedule yet, push the default up so it's persisted
          if (!dbHadSchedule) {
            pending.current = { schedule: defaultSchedule };
            flushToDb();
          }
        }, 100);
      }
    })();
  }, [isAuthenticated, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Debounced DB sync on state change ----
  useEffect(() => { queueSync({ goals });    }, [goals]);    // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { queueSync({ schedule }); }, [schedule]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { queueSync({ plan });     }, [plan]);     // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { queueSync({ avatar });   }, [avatar]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ goals, setGoals, schedule, setSchedule, plan, setPlan, avatar, setAvatar, dataLoaded }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
