import { createContext, useContext, useState } from "react";

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
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule);
  const [plan, setPlan] = useState<DayPlan[] | null>(null);

  return (
    <AppContext.Provider value={{ goals, setGoals, schedule, setSchedule, plan, setPlan }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
