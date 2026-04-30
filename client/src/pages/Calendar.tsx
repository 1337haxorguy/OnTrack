import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { DayPlan, TimeBlock } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE;

// ---- Grid constants ----
const HOUR_HEIGHT = 64;
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---- Goal color palette (assigned by goal index) ----
const GOAL_COLORS = [
  { stripe: "#2F7D5E", bg: "#E8F1EC", text: "#1F5E46", border: "#D9E8DF" },
  { stripe: "#C76A3F", bg: "#FBEFE6", text: "#8E4A22", border: "#F0D8C8" },
  { stripe: "#4F6BD0", bg: "#ECEEFA", text: "#2C3D7B", border: "#D4D9F5" },
  { stripe: "#8B6FB1", bg: "#F1ECF6", text: "#4F3970", border: "#E0D5ED" },
  { stripe: "#C49A3A", bg: "#FAF3E0", text: "#7A5C1A", border: "#EDE0B8" },
];

type CalendarView = "day" | "week" | "month";

// ---- Helpers ----
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minsToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function formatHour(h: number): string {
  if (h === 0) return "12 am";
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function calcEndTime(startTime: string, tasks: { estimated_minutes: number }[]): string {
  const totalMins = tasks.reduce((s, t) => s + t.estimated_minutes, 0);
  const [h, m] = startTime.split(":").map(Number);
  const endMins = h * 60 + m + totalMins;
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let current = getWeekStart(firstDay);
  const weeks: Date[][] = [];
  while (current <= lastDay) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function fmtDateShort(d: Date, withYear = false): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function fmtMinsDuration(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---- Types ----
interface SelectedEvent {
  dayPlan: DayPlan;
  dayIdx: number;
  block: TimeBlock;
  blockIdx: number;
}

interface DragState {
  block: TimeBlock;
  dayPlan: DayPlan;
  dayIdx: number;
  blockIdx: number;
  offsetMins: number;
  originalDate: string;
  previewDate: string;
  previewStartMins: number;
  active: boolean;
  startX: number;
  startY: number;
}

// ---- Component ----
export default function Calendar() {
  const { goals, setGoals, schedule, plan, setPlan, incrementGenerations } = useApp();
  const { isAuthenticated, getToken } = useAuth();

  useEffect(() => { document.title = "Calendar — OnTrack"; }, []);

  // Lock page scroll — calendar has its own internal scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const [view, setView] = useState<CalendarView>("week");
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (plan && plan.length > 0) return new Date(plan[0].date + "T00:00:00");
    return new Date();
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [modalMode, setModalMode] = useState<"detail" | "regen" | "regen-block" | "reschedule">("detail");
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenBlockFeedback, setRegenBlockFeedback] = useState("");
  const [regenBlockLoading, setRegenBlockLoading] = useState(false);
  const [rsDate, setRsDate] = useState("");
  const [rsStart, setRsStart] = useState("");
  const [taskModalMode, setTaskModalMode] = useState<Record<number, "regen" | "edit" | null>>({});
  const [taskModalFeedback, setTaskModalFeedback] = useState<Record<number, string>>({});
  const [taskModalRegen, setTaskModalRegen] = useState<Record<number, boolean>>({});
  const [taskModalEdit, setTaskModalEdit] = useState<Record<number, { title: string; description: string; estimated_minutes: number }>>({});
  const [pendingSave, setPendingSave] = useState<{ feedback: string; goalId: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const weekDaysRef = useRef<Date[]>([]);
  const viewRef = useRef(view);
  const today = toDateStr(new Date());

  // Scroll to 7 AM on mount / view switch
  useEffect(() => {
    if ((view === "week" || view === "day") && gridRef.current) {
      gridRef.current.scrollTop = (7 - START_HOUR) * HOUR_HEIGHT;
    }
  }, [view]);

  // Drag-to-reschedule
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current || !gridRef.current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (!current.active && Math.sqrt(dx * dx + dy * dy) < 5) return;
      const gridEl = gridRef.current;
      const gridRect = gridEl.getBoundingClientRect();
      const scrollTop = gridEl.scrollTop;
      const relativeY = e.clientY - gridRect.top + scrollTop;
      const rawMins = START_HOUR * 60 + (relativeY / HOUR_HEIGHT) * 60 - current.offsetMins;
      const durationMins = current.block.end_time
        ? timeToMinutes(current.block.end_time) - timeToMinutes(current.block.start_time!)
        : 60;
      const snapped = Math.round(rawMins / 30) * 30;
      const previewStartMins = Math.max(START_HOUR * 60, Math.min(snapped, END_HOUR * 60 - durationMins));
      let previewDate = current.previewDate;
      if (viewRef.current === "week" && weekDaysRef.current.length > 0) {
        const gutterWidth = 56;
        const relativeX = e.clientX - gridRect.left;
        const colWidth = (gridRect.width - gutterWidth) / 7;
        const colIdx = Math.max(0, Math.min(6, Math.floor((relativeX - gutterWidth) / colWidth)));
        previewDate = toDateStr(weekDaysRef.current[colIdx]);
      }
      const next: DragState = { ...current, active: true, previewDate, previewStartMins };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => {
      const current = dragRef.current;
      if (!current) return;
      if (current.active) {
        const durationMins = current.block.end_time
          ? timeToMinutes(current.block.end_time) - timeToMinutes(current.block.start_time!)
          : 60;
        const updatedBlock: TimeBlock = {
          ...current.block,
          start_time: minsToTime(current.previewStartMins),
          end_time: minsToTime(current.previewStartMins + durationMins),
        };
        setPlan((prev) => {
          if (!prev) return prev;
          if (current.previewDate === current.originalDate) {
            return prev.map((d, di) =>
              di === current.dayIdx
                ? { ...d, time_blocks: d.time_blocks.map((b, bi) => (bi === current.blockIdx ? updatedBlock : b)) }
                : d
            );
          }
          let newPlan = prev
            .map((d, di) =>
              di === current.dayIdx
                ? { ...d, time_blocks: d.time_blocks.filter((_, bi) => bi !== current.blockIdx) }
                : d
            )
            .filter((d) => d.time_blocks.length > 0);
          const targetIdx = newPlan.findIndex((d) => d.date === current.previewDate);
          if (targetIdx >= 0) {
            newPlan[targetIdx] = {
              ...newPlan[targetIdx],
              time_blocks: [...newPlan[targetIdx].time_blocks, updatedBlock].sort(
                (a, b) => timeToMinutes(a.start_time || "00:00") - timeToMinutes(b.start_time || "00:00")
              ),
            };
          } else {
            newPlan.push({ date: current.previewDate, objective: `Rescheduled: ${updatedBlock.label}`, time_blocks: [updatedBlock] });
            newPlan.sort((a, b) => a.date.localeCompare(b.date));
          }
          return newPlan;
        });
      } else {
        setSelectedEvent({ dayPlan: current.dayPlan, dayIdx: current.dayIdx, block: current.block, blockIdx: current.blockIdx });
        setModalMode("detail");
      }
      dragRef.current = null;
      setDrag(null);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  const navigate = (dir: 1 | -1) => {
    if (view === "day") setViewDate((d) => addDays(d, dir));
    else if (view === "week") setViewDate((d) => addDays(d, dir * 7));
    else setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const goToDay = (d: Date) => {
    setViewDate(d);
    setView("day");
  };

  const authHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAuthenticated) {
      const token = await getToken().catch(() => null);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const generate = async () => {
    if (goals.length === 0) return;
    setLoading(true);
    setError("");
    setPlan(null);
    setSelectedEvent(null);
    try {
      const totalHours = goals.reduce((s, g) => s + g.hours_per_week, 0);
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          goals,
          availability: schedule,
          preferences: { hours_per_week: totalHours, sessions_per_day: 1 },
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const planWithIds: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(planWithIds);
      if (planWithIds.length > 0) setViewDate(new Date(planWithIds[0].date + "T00:00:00"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const regenerateDay = async () => {
    if (!plan || !selectedEvent) return;
    setRegenLoading(true);
    setError("");
    try {
      const { dayIdx } = selectedEvent;
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: plan[dayIdx].date,
          current_day_plan: plan[dayIdx],
          feedback: regenFeedback,
          goals,
          availability: schedule,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "generation_limit_reached") throw new Error("You've used all your free generations.");
        }
        throw new Error(`Server error: ${res.status}`);
      }
      const data = await res.json();
      if (data) {
        const newDay: DayPlan = {
          ...data,
          time_blocks: (data.time_blocks || []).map((b: TimeBlock) => ({ ...b, id: crypto.randomUUID() })),
        };
        setPlan((prev) => prev!.map((d, i) => (i === dayIdx ? newDay : d)));
      }
      incrementGenerations();
      setSelectedEvent(null);
      setRegenFeedback("");
      setTaskModalMode({});
      setTaskModalFeedback({});
      setTaskModalEdit({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to regenerate day");
    } finally {
      setRegenLoading(false);
    }
  };

  const regenerateSelectedBlock = async () => {
    if (!plan || !selectedEvent) return;
    const { dayIdx, blockIdx } = selectedEvent;
    const block = plan[dayIdx].time_blocks[blockIdx];
    setRegenBlockLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: plan[dayIdx].date,
          current_day_plan: { date: plan[dayIdx].date, objective: block.label, time_blocks: [{ ...block, start_time: null, end_time: null }] },
          feedback: regenBlockFeedback || `Regenerate only the "${block.label}" block.`,
          goals,
          availability: schedule,
          preserve_times: true,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "generation_limit_reached") throw new Error("You've used all your free generations.");
        }
        throw new Error(`Server error: ${res.status}`);
      }
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
      const newBlock = data.time_blocks?.[0];
      if (newBlock) {
        const endTime = block.start_time ? calcEndTime(block.start_time, newBlock.tasks) : block.end_time;
        const mergedBlock = { ...block, tasks: newBlock.tasks, end_time: endTime, id: crypto.randomUUID() };
        setPlan(prev => prev!.map((d, di) =>
          di !== dayIdx ? d : { ...d, time_blocks: d.time_blocks.map((b, bi) => bi === blockIdx ? mergedBlock : b) }
        ));
        setSelectedEvent(prev => prev ? { ...prev, block: { ...mergedBlock, id: prev.block.id } } : null);
      }
      incrementGenerations();
      if (regenBlockFeedback && goals.length > 0) setPendingSave({ feedback: regenBlockFeedback, goalId: goals[0].id });
      setRegenBlockFeedback("");
      setModalMode("detail");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to regenerate block");
    } finally {
      setRegenBlockLoading(false);
    }
  };

  const regenerateSelectedTask = async (ti: number) => {
    if (!plan || !selectedEvent) return;
    const { dayIdx, blockIdx } = selectedEvent;
    const block = plan[dayIdx].time_blocks[blockIdx];
    const task = block.tasks[ti];
    const fb = taskModalFeedback[ti] || "";
    setTaskModalRegen(prev => ({ ...prev, [ti]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: plan[dayIdx].date,
          current_day_plan: { date: plan[dayIdx].date, objective: block.label, time_blocks: [{ ...block, tasks: [task], start_time: null, end_time: null }] },
          feedback: fb || `Regenerate only the "${task.title}" task in "${block.label}". Return exactly 1 time block with exactly 1 task.`,
          goals,
          availability: schedule,
          preserve_times: true,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
      const newTask = data.time_blocks?.[0]?.tasks?.[0];
      if (newTask) {
        const updatedTasks = block.tasks.map((t, j) => (j === ti ? newTask : t));
        const endTime = block.start_time ? calcEndTime(block.start_time, updatedTasks) : block.end_time;
        const updatedBlock = { ...block, tasks: updatedTasks, end_time: endTime };
        setPlan(prev => prev!.map((d, di) =>
          di !== dayIdx ? d : { ...d, time_blocks: d.time_blocks.map((b, bi) => bi === blockIdx ? updatedBlock : b) }
        ));
        setSelectedEvent(prev => prev ? { ...prev, block: updatedBlock } : null);
      }
      if (fb && goals.length > 0) setPendingSave({ feedback: fb, goalId: goals[0].id });
      setTaskModalFeedback(prev => ({ ...prev, [ti]: "" }));
      setTaskModalMode(prev => ({ ...prev, [ti]: null }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to regenerate task");
    } finally {
      setTaskModalRegen(prev => ({ ...prev, [ti]: false }));
    }
  };

  const saveSelectedTaskEdit = (ti: number) => {
    if (!plan || !selectedEvent) return;
    const { dayIdx, blockIdx } = selectedEvent;
    const block = plan[dayIdx].time_blocks[blockIdx];
    const edits = taskModalEdit[ti];
    if (!edits) return;
    const updatedTasks = block.tasks.map((t, j) => (j === ti ? { ...t, ...edits } : t));
    const updatedBlock = { ...block, tasks: updatedTasks };
    setPlan(prev => prev!.map((d, di) =>
      di !== dayIdx ? d : { ...d, time_blocks: d.time_blocks.map((b, bi) => bi === blockIdx ? updatedBlock : b) }
    ));
    setSelectedEvent(prev => prev ? { ...prev, block: updatedBlock } : null);
    setTaskModalMode(prev => ({ ...prev, [ti]: null }));
    setTaskModalEdit(prev => { const n = { ...prev }; delete n[ti]; return n; });
  };

  const openReschedule = () => {
    if (!selectedEvent || !plan) return;
    const { dayIdx, block } = selectedEvent;
    setRsDate(plan[dayIdx].date);
    setRsStart(block.start_time || "");
    setModalMode("reschedule");
  };

  const toggleTaskComplete = (dayIdx: number, blockIdx: number, taskIdx: number) => {
    setPlan((prev) =>
      prev!.map((d, di) =>
        di !== dayIdx ? d : {
          ...d,
          time_blocks: d.time_blocks.map((b, bi) =>
            bi !== blockIdx ? b : {
              ...b,
              tasks: b.tasks.map((t, ti) => ti !== taskIdx ? t : { ...t, completed: !t.completed }),
            }
          ),
        }
      )
    );
  };

  const toggleBlockComplete = (dayIdx: number, blockIdx: number) => {
    if (!plan) return;
    const allDone = plan[dayIdx]?.time_blocks[blockIdx]?.tasks.every(t => t.completed);
    setPlan(prev => prev!.map((d, di) =>
      di !== dayIdx ? d : {
        ...d,
        time_blocks: d.time_blocks.map((b, bi) =>
          bi !== blockIdx ? b : { ...b, tasks: b.tasks.map(t => ({ ...t, completed: !allDone })) }
        ),
      }
    ));
  };

  const applyReschedule = () => {
    if (!plan || !selectedEvent) return;
    const { dayIdx, blockIdx } = selectedEvent;
    const block = plan[dayIdx].time_blocks[blockIdx];
    const durationMins =
      block.start_time && block.end_time
        ? timeToMinutes(block.end_time) - timeToMinutes(block.start_time)
        : 60;
    const updatedBlock = { ...block, start_time: rsStart, end_time: minsToTime(timeToMinutes(rsStart) + durationMins) };
    if (rsDate === plan[dayIdx].date) {
      setPlan((prev) =>
        prev!.map((d, di) =>
          di === dayIdx ? { ...d, time_blocks: d.time_blocks.map((b, bi) => (bi === blockIdx ? updatedBlock : b)) } : d
        )
      );
    } else {
      let newPlan = plan
        .map((d, di) =>
          di === dayIdx ? { ...d, time_blocks: d.time_blocks.filter((_, bi) => bi !== blockIdx) } : d
        )
        .filter((d) => d.time_blocks.length > 0);
      const targetIdx = newPlan.findIndex((d) => d.date === rsDate);
      if (targetIdx >= 0) {
        newPlan[targetIdx] = { ...newPlan[targetIdx], time_blocks: [...newPlan[targetIdx].time_blocks, updatedBlock] };
      } else {
        newPlan.push({ date: rsDate, objective: `Rescheduled: ${updatedBlock.label}`, time_blocks: [updatedBlock] });
        newPlan.sort((a, b) => a.date.localeCompare(b.date));
      }
      setPlan(newPlan);
    }
    setSelectedEvent(null);
  };

  // Sync refs
  viewRef.current = view;

  // Build date → plan lookup
  const planByDate: Record<string, { dayPlan: DayPlan; dayIdx: number }> = {};
  if (plan) {
    plan.forEach((dayPlan, dayIdx) => { planByDate[dayPlan.date] = { dayPlan, dayIdx }; });
  }

  // Assign a color palette entry to a block label by matching against goal titles
  const getBlockColor = (label: string) => {
    if (goals.length === 0) return GOAL_COLORS[0];
    const words = label.toLowerCase().split(/\s+/);
    let bestIdx = -1, bestOverlap = 0;
    goals.forEach((g, i) => {
      const gWords = g.title.toLowerCase().split(/\s+/);
      const overlap = words.filter(w => gWords.some(gw => gw.includes(w) || w.includes(gw))).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; bestIdx = i; }
    });
    return GOAL_COLORS[(bestIdx >= 0 ? bestIdx : 0) % GOAL_COLORS.length];
  };

  const handleBlockPointerDown = (
    e: React.PointerEvent,
    block: TimeBlock,
    dayPlan: DayPlan,
    dayIdx: number,
    blockIdx: number,
    dateStr: string,
  ) => {
    if (!block.start_time) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetMins = Math.max(0, ((e.clientY - rect.top) / HOUR_HEIGHT) * 60);
    const state: DragState = {
      block, dayPlan, dayIdx, blockIdx, offsetMins,
      originalDate: dateStr, previewDate: dateStr,
      previewStartMins: timeToMinutes(block.start_time),
      active: false, startX: e.clientX, startY: e.clientY,
    };
    setDrag(state);
    dragRef.current = state;
  };

  const now = new Date();
  const currentTimeTop = ((now.getHours() + now.getMinutes() / 60) - START_HOUR) * HOUR_HEIGHT;

  // ---- Time grid column ----
  const renderTimeColumn = (d: Date, isSingleDay = false) => {
    const dateStr = toDateStr(d);
    const entry = planByDate[dateStr];
    const isToday = dateStr === today;

    const timedBlocks: { block: TimeBlock; blockIdx: number }[] = [];
    const untimedBlocks: { block: TimeBlock; blockIdx: number }[] = [];
    if (entry) {
      entry.dayPlan.time_blocks.forEach((block, blockIdx) => {
        if (block.start_time && block.end_time) timedBlocks.push({ block, blockIdx });
        else untimedBlocks.push({ block, blockIdx });
      });
    }

    return (
      <div
        key={dateStr}
        className="flex-1 relative border-l border-black/[0.05]"
        style={isToday ? { background: "linear-gradient(180deg, rgba(47,125,94,.04) 0%, rgba(47,125,94,0) 100%)" } : undefined}
      >
        {/* Hour lines */}
        {HOURS.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-t border-black/[0.05]"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }} />
        ))}
        {HOURS.map((h) => (
          <div key={`${h}-half`} className="absolute left-0 right-0 border-t border-black/[0.03]"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
        ))}

        {/* Schedule overlays */}
        {(() => {
          const dayName = d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
          const totalGridMins = (END_HOUR - START_HOUR) * 60;
          const overlayPos = (start: string, end: string) => {
            const s = Math.max(timeToMinutes(start) - START_HOUR * 60, 0);
            const e = Math.min(timeToMinutes(end) - START_HOUR * 60, totalGridMins);
            if (e <= s) return null;
            return { top: `${(s / 60) * HOUR_HEIGHT}px`, height: `${((e - s) / 60) * HOUR_HEIGHT}px` };
          };
          const freeSlots = schedule.free_slots[dayName] || [];
          const recurringForDay = schedule.recurring_blocks.filter((rb) => rb.days.includes(dayName));
          const specificForDay = schedule.specific_blocks.filter((sb) => sb.date === dateStr);
          return (
            <>
              {freeSlots.map((slot, i) => {
                const pos = overlayPos(slot.start, slot.end);
                if (!pos) return null;
                return <div key={`free-${i}`} className="absolute left-0 right-0 bg-emerald-500/[0.08] pointer-events-none z-[1]" style={pos} />;
              })}
              {recurringForDay.map((rb) => {
                const pos = overlayPos(rb.start_time, rb.end_time);
                if (!pos) return null;
                const h = parseFloat(pos.height);
                return (
                  <div key={`rb-${rb.id}`} className="absolute left-0 right-0 bg-red-900/30 border-l-2 border-red-700/50 pointer-events-none z-[2] overflow-hidden" style={pos}>
                    {h >= 18 && <p className="text-[9px] text-red-400/80 font-medium px-1.5 pt-0.5 truncate leading-tight select-none">{rb.label}</p>}
                  </div>
                );
              })}
              {specificForDay.map((sb) => {
                if (sb.all_day) return (
                  <div key={`sb-${sb.id}`} className="absolute inset-0 bg-red-900/25 border-l-2 border-red-700/50 pointer-events-none z-[2] overflow-hidden">
                    <p className="text-[9px] text-red-400/80 font-medium px-1.5 pt-1 truncate leading-tight select-none">{sb.label || "Blocked"}</p>
                  </div>
                );
                const pos = overlayPos(sb.start_time, sb.end_time);
                if (!pos) return null;
                const h = parseFloat(pos.height);
                return (
                  <div key={`sb-${sb.id}`} className="absolute left-0 right-0 bg-red-900/30 border-l-2 border-red-700/50 pointer-events-none z-[2] overflow-hidden" style={pos}>
                    {h >= 18 && <p className="text-[9px] text-red-400/80 font-medium px-1.5 pt-0.5 truncate leading-tight select-none">{sb.label || "Blocked"}</p>}
                  </div>
                );
              })}
            </>
          );
        })()}

        {/* Now-line (green) */}
        {isToday && currentTimeTop > 0 && currentTimeTop < HOURS.length * HOUR_HEIGHT && (
          <div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
            style={{ top: `${currentTimeTop}px` }}>
            <div className="w-2 h-2 rounded-full bg-[#2F7D5E] -ml-1 shrink-0" />
            <div className="flex-1 h-px bg-[#2F7D5E]" />
          </div>
        )}

        {/* Timed event blocks */}
        {timedBlocks.map(({ block, blockIdx }) => {
          const startMins = Math.max(timeToMinutes(block.start_time!), START_HOUR * 60);
          const endMins = Math.min(timeToMinutes(block.end_time!), END_HOUR * 60);
          const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 22);
          const isSelected = selectedEvent?.dayIdx === entry!.dayIdx && selectedEvent?.blockIdx === blockIdx;
          const isDragging = drag?.active && drag.dayIdx === entry!.dayIdx && drag.blockIdx === blockIdx;
          const allDone = block.tasks.length > 0 && block.tasks.every((t) => t.completed);
          const color = getBlockColor(block.label);
          const isShort = height < 38;

          return (
            <div
              key={block.id}
              className={`absolute rounded-[8px] overflow-hidden select-none cursor-grab transition-all z-[5]
                ${isSelected ? "ring-1 ring-black/20 z-10" : "hover:-translate-y-px hover:shadow-[0_6px_14px_-10px_rgba(0,0,0,0.18)]"}
                ${isDragging ? "opacity-25" : ""}
              `}
              style={{
                top: `${top}px`,
                height: `${height}px`,
                left: isSingleDay ? "16px" : "6px",
                right: isSingleDay ? "16px" : "6px",
                backgroundColor: allDone ? color.bg : "#fff",
                border: `1px solid ${allDone ? color.border : "rgba(13,13,13,0.10)"}`,
                borderLeftWidth: "3px",
                borderLeftColor: color.stripe,
                paddingLeft: "8px",
                paddingRight: "6px",
                paddingTop: "4px",
                paddingBottom: "4px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "1px",
              }}
              onPointerDown={(e) =>
                handleBlockPointerDown(e, block, entry!.dayPlan, entry!.dayIdx, blockIdx, dateStr)
              }
            >
              <p className={`text-[12px] font-bold leading-[1.2] truncate tracking-[-0.005em] ${allDone ? "line-through" : ""}`}
                style={{ color: allDone ? color.text : "#0D0D0D", textDecorationColor: color.stripe }}>
                {block.label}
              </p>
              {!isShort && block.start_time && block.end_time && (
                <p className="text-[10.5px] leading-[1.15] truncate" style={{ color: "rgba(13,13,13,0.4)" }}>
                  {formatTime(block.start_time)} – {formatTime(block.end_time)}
                </p>
              )}
            </div>
          );
        })}

        {/* Drag ghost */}
        {drag?.active && drag.previewDate === dateStr && (() => {
          const durationMins = drag.block.end_time
            ? timeToMinutes(drag.block.end_time) - timeToMinutes(drag.block.start_time!)
            : 60;
          const ghostStart = Math.max(drag.previewStartMins, START_HOUR * 60);
          const ghostEnd = Math.min(ghostStart + durationMins, END_HOUR * 60);
          const ghostTop = ((ghostStart - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const ghostHeight = Math.max(((ghostEnd - ghostStart) / 60) * HOUR_HEIGHT, 22);
          return (
            <div
              className="absolute rounded-lg bg-black/[0.05] border border-black/20 border-dashed z-20 pointer-events-none"
              style={{ top: `${ghostTop}px`, height: `${ghostHeight}px`, left: isSingleDay ? "16px" : "6px", right: isSingleDay ? "16px" : "6px" }}
            >
              <p className="text-[11px] font-semibold text-black/60 leading-tight truncate px-2 pt-1">{drag.block.label}</p>
            </div>
          );
        })()}

        {/* Untimed blocks */}
        {untimedBlocks.length > 0 && (
          <div className="absolute top-2 left-1 right-1 flex flex-col gap-0.5 z-[5]">
            {untimedBlocks.map(({ block, blockIdx }) => {
              const color = getBlockColor(block.label);
              return (
                <button
                  key={block.id}
                  className="rounded px-1.5 py-0.5 text-left transition-colors bg-white border hover:border-black/20"
                  style={{ borderLeftWidth: "3px", borderLeftColor: color.stripe, borderColor: "rgba(13,13,13,0.10)" }}
                  onClick={() => {
                    setSelectedEvent({ dayPlan: entry!.dayPlan, dayIdx: entry!.dayIdx, block, blockIdx });
                    setModalMode("detail");
                  }}
                >
                  <p className="text-[10px] font-medium text-black truncate">{block.label}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---- Time gutter ----
  const renderTimeGutter = (gutterWidth = "w-14") => (
    <div className={`${gutterWidth} shrink-0 relative select-none bg-black/[0.03] border-r border-black/8`}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute right-2 text-[10px] font-semibold tracking-[0.04em] tabular-nums"
          style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT - 7}px`, color: "rgba(13,13,13,0.4)" }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  );

  // ---- Derived ----
  const weekStart = getWeekStart(viewDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  weekDaysRef.current = weekDays;
  const monthGrid = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth());

  // ---- Subtitle ----
  const computeSubtitle = () => {
    if (view === "week") {
      const wEnd = addDays(weekStart, 6);
      const blocks = weekDays.flatMap(d => planByDate[toDateStr(d)]?.dayPlan.time_blocks ?? []);
      const totalMins = blocks.reduce((s, b) => s + b.tasks.reduce((ts, t) => ts + t.estimated_minutes, 0), 0);
      const dateRange = `${fmtDateShort(weekStart)} – ${fmtDateShort(wEnd, true)}`;
      if (!plan || blocks.length === 0) return dateRange;
      return `${dateRange} · ${blocks.length} block${blocks.length !== 1 ? "s" : ""}${totalMins > 0 ? ` · ${fmtMinsDuration(totalMins)} planned` : ""}`;
    }
    if (view === "day") {
      const blocks = planByDate[toDateStr(viewDate)]?.dayPlan.time_blocks ?? [];
      const totalMins = blocks.reduce((s, b) => s + b.tasks.reduce((ts, t) => ts + t.estimated_minutes, 0), 0);
      const dateLabel = viewDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      if (!plan || blocks.length === 0) return dateLabel;
      return `${dateLabel} · ${blocks.length} block${blocks.length !== 1 ? "s" : ""}${totalMins > 0 ? ` · ${fmtMinsDuration(totalMins)}` : ""}`;
    }
    // month
    const label = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!plan) return label;
    const mBlocks = monthGrid.flat().flatMap(d => planByDate[toDateStr(d)]?.dayPlan.time_blocks ?? []);
    return mBlocks.length > 0 ? `${label} · ${mBlocks.length} block${mBlocks.length !== 1 ? "s" : ""}` : label;
  };

  const headingWord = view === "month" ? "month." : view === "day" ? "day." : "week.";

  // ---- Empty (no goals) ----
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-xl font-bold text-black mb-2">no goals yet</h2>
        <p className="text-black/40 mb-6 text-sm">create a goal first, then generate your plan.</p>
        <Link to="/goals/new" className="px-5 py-2.5 bg-black text-white rounded-full text-sm hover:bg-black/80 transition-colors font-medium">
          create a goal
        </Link>
      </div>
    );
  }

  const closeModal = () => {
    setSelectedEvent(null);
    setModalMode("detail");
    setTaskModalMode({});
    setTaskModalEdit({});
    setPendingSave(null);
  };

  return (
    <>
      {/* ---- Single header + controls row ---- */}
      <div className="flex items-center justify-between gap-4 mb-3">
        {/* Left: title + subtitle (hidden when expanded) */}
        <div className="flex items-center gap-4 min-w-0">
          {!expanded && (
            <div className="min-w-0 shrink-0">
              <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-black leading-none">
                your <span className="cal-slab">{headingWord}</span>
              </h1>
              <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "rgba(13,13,13,0.4)" }}>{computeSubtitle()}</p>
            </div>
          )}
          {/* Nav arrows + today */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-black/[0.12] hover:border-black/25 transition-colors" style={{ color: "rgba(13,13,13,0.6)" }} aria-label="previous">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1L1 6l5 5"/></svg>
            </button>
            <button onClick={() => navigate(1)}  className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-black/[0.12] hover:border-black/25 transition-colors" style={{ color: "rgba(13,13,13,0.6)" }} aria-label="next">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l5 5-5 5"/></svg>
            </button>
            <button onClick={() => setViewDate(new Date())} className="px-2.5 py-1 text-[11.5px] font-semibold rounded-full hover:bg-black/5 transition-colors" style={{ color: "rgba(13,13,13,0.6)" }}>today</button>
          </div>
        </div>
        {/* Right: regen + view segment + expand */}
        <div className="flex items-center gap-2 shrink-0">
          {error && <span className="text-xs text-red-500">{error}</span>}
          <button onClick={generate} disabled={loading} className="px-3 py-1.5 text-[12px] font-semibold rounded-full border border-black/[0.12] bg-white text-black/60 hover:border-black/25 hover:text-black disabled:opacity-40 transition-all">
            {loading ? "generating…" : plan ? "↻ regenerate week" : "generate plan"}
          </button>
          <div className="flex p-1 rounded-full gap-0.5 border border-black/[0.08]" style={{ background: "rgba(13,13,13,0.05)" }}>
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all ${view === v ? "bg-black text-white" : "text-black/60 hover:text-black"}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => setExpanded(e => !e)} title={expanded ? "collapse" : "expand"} className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-black/[0.12] hover:border-black/25 transition-colors" style={{ color: "rgba(13,13,13,0.5)" }}>
            {expanded
              ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 5l5 5 5-5"/></svg>
              : <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 9l5-5 5 5"/></svg>
            }
          </button>
        </div>
      </div>

      {/* ---- Calendar card ---- */}
      <div
        className="bg-white border border-black/[0.08] rounded-[18px] overflow-hidden flex flex-col"
        style={{ height: "calc(100vh - 160px)", minHeight: "400px" }}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm gap-3">
            <div className="w-7 h-7 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            <span className="text-sm text-black/40">generating your plan…</span>
          </div>
        )}

        {/* No-plan overlay */}
        {!plan && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F9F9F9]/80 backdrop-blur-sm" style={{ borderRadius: "18px" }}>
            <div className="bg-white border border-black/8 rounded-2xl p-8 text-center shadow-xl max-w-xs mx-4">
              <div className="w-12 h-12 rounded-2xl bg-black/5 border border-black/8 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-black mb-1.5">calendar is empty</h3>
              <p className="text-sm text-black/40 mb-4">
                generate a weekly plan from your {goals.length} goal{goals.length !== 1 && "s"} to fill in your week.
              </p>
              <button className="px-5 py-2.5 bg-[#2F7D5E] text-white rounded-full text-sm font-medium hover:bg-[#1F5E46] transition-colors" onClick={generate}>
                generate plan
              </button>
            </div>
          </div>
        )}

        {/* ==== WEEK VIEW ==== */}
        {view === "week" && (
          <>
            {/* Day column headers */}
            <div className="flex shrink-0 border-b border-black/[0.08]" style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)" }}>
              <div style={{ background: "rgba(13,13,13,0.03)" }} />
              {weekDays.map((d, i) => {
                const dateStr = toDateStr(d);
                const isToday = dateStr === today;
                const isWeekend = i >= 5;
                return (
                  <button
                    key={i}
                    className="flex flex-col items-center py-3.5 border-l border-black/[0.05] hover:bg-black/[0.02] transition-colors"
                    onClick={() => goToDay(d)}
                  >
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase mb-1.5"
                      style={{ color: "rgba(13,13,13,0.4)" }}>
                      {DAY_LABELS[i].toLowerCase()}
                    </span>
                    <span
                      className="w-8 h-8 flex items-center justify-center rounded-full text-[18px] font-bold leading-none"
                      style={{
                        background: isToday ? "#0D0D0D" : "transparent",
                        color: isToday ? "#fff" : isWeekend ? "rgba(13,13,13,0.25)" : "#0D0D0D",
                      }}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Grid */}
            <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                {renderTimeGutter()}
                {weekDays.map((d) => renderTimeColumn(d))}
              </div>
            </div>
          </>
        )}

        {/* ==== DAY VIEW ==== */}
        {view === "day" && (
          <>
            {/* Day header */}
            <div className="flex shrink-0 border-b border-black/[0.08]" style={{ display: "grid", gridTemplateColumns: "56px 1fr" }}>
              <div style={{ background: "rgba(13,13,13,0.03)" }} />
              <div className="flex items-center gap-3 px-5 py-3.5 border-l border-black/[0.05]">
                <span
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[18px] font-bold"
                  style={{ background: toDateStr(viewDate) === today ? "#0D0D0D" : "transparent", color: toDateStr(viewDate) === today ? "#fff" : "#0D0D0D" }}
                >
                  {viewDate.getDate()}
                </span>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: "rgba(13,13,13,0.4)" }}>
                    {viewDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()}
                  </div>
                  {(() => {
                    const blocks = planByDate[toDateStr(viewDate)]?.dayPlan.time_blocks ?? [];
                    const totalMins = blocks.reduce((s, b) => s + b.tasks.reduce((ts, t) => ts + t.estimated_minutes, 0), 0);
                    if (blocks.length === 0) return null;
                    return (
                      <div className="text-[12px] mt-0.5" style={{ color: "rgba(13,13,13,0.4)" }}>
                        {blocks.length} block{blocks.length !== 1 ? "s" : ""}{totalMins > 0 ? ` · ${fmtMinsDuration(totalMins)}` : ""}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            {/* Grid */}
            <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                {renderTimeGutter()}
                {renderTimeColumn(viewDate, true)}
              </div>
            </div>
          </>
        )}

        {/* ==== MONTH VIEW ==== */}
        {view === "month" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 shrink-0 border-b border-black/[0.08]">
              {DAY_LABELS.map((label) => (
                <div key={label} className="py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(13,13,13,0.4)" }}>
                  {label.toLowerCase()}
                </div>
              ))}
            </div>
            {/* Weeks */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {monthGrid.map((week, wi) => (
                <div key={wi} className="flex-1 grid grid-cols-7 border-t border-black/[0.05] min-h-0">
                  {week.map((d, di) => {
                    const dateStr = toDateStr(d);
                    const isToday = dateStr === today;
                    const isCurrentMonth = d.getMonth() === viewDate.getMonth();
                    const entry = planByDate[dateStr];
                    const allBlocks = entry?.dayPlan.time_blocks ?? [];
                    const MAX_CHIPS = 3;
                    return (
                      <div
                        key={di}
                        className={`border-l border-black/[0.05] p-2.5 overflow-hidden flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-black/[0.02] ${di === 0 ? "border-l-0" : ""} ${!isCurrentMonth ? "opacity-40 bg-black/[0.02]" : ""}`}
                        onClick={() => goToDay(d)}
                      >
                        <span
                          className="self-start w-[26px] h-[26px] flex items-center justify-center rounded-full text-[13px] font-bold"
                          style={{
                            background: isToday ? "#0D0D0D" : "transparent",
                            color: isToday ? "#fff" : "rgba(13,13,13,0.7)",
                          }}
                        >
                          {d.getDate()}
                        </span>
                        <div className="flex flex-col gap-[3px]">
                          {allBlocks.slice(0, MAX_CHIPS).map((block) => {
                            const color = getBlockColor(block.label);
                            return (
                              <div
                                key={block.id}
                                className="text-[10.5px] font-semibold px-1.5 py-[3px] rounded-[6px] truncate"
                                style={{
                                  background: color.bg,
                                  color: color.text,
                                  borderLeft: `2px solid ${color.stripe}`,
                                }}
                              >
                                {block.label}
                              </div>
                            );
                          })}
                          {allBlocks.length > MAX_CHIPS && (
                            <div className="text-[10.5px] font-semibold px-1" style={{ color: "rgba(13,13,13,0.4)" }}>
                              +{allBlocks.length - MAX_CHIPS} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Block detail modal ---- */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-[60px_24px] backdrop-blur-[2px]"
          style={{ background: "rgba(13,13,13,0.32)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="relative bg-white w-full max-w-[520px] rounded-[18px] border border-black/[0.08]"
            style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.25)", padding: "22px 22px 18px" }}
          >
            {/* Close */}
            <button
              onClick={closeModal}
              className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full text-[16px] leading-none transition-colors hover:bg-black/5"
              style={{ color: "rgba(13,13,13,0.4)" }}
            >
              ✕
            </button>

            {/* Goal tag chip */}
            {(() => {
              const color = getBlockColor(selectedEvent.block.label);
              const matchedGoal = goals.find((_g, i) => GOAL_COLORS[i % GOAL_COLORS.length].stripe === color.stripe);
              const tagLabel = matchedGoal?.title.toLowerCase() ?? selectedEvent.block.label.toLowerCase().split(" ")[0];
              return (
                <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full mb-3"
                  style={{ background: color.bg, color: color.text }}>
                  <span className="w-[5px] h-[5px] rounded-full" style={{ background: color.text, opacity: 0.8 }} />
                  {tagLabel}
                </div>
              );
            })()}

            {/* Title + time + date */}
            <div className="flex items-start gap-2 mb-0.5 pr-8">
              {(() => {
                const tasks = plan?.[selectedEvent.dayIdx]?.time_blocks[selectedEvent.blockIdx]?.tasks ?? selectedEvent.block.tasks;
                const allDone = tasks.length > 0 && tasks.every(t => t.completed);
                const someDone = !allDone && tasks.some(t => t.completed);
                return (
                  <button
                    onClick={() => toggleBlockComplete(selectedEvent.dayIdx, selectedEvent.blockIdx)}
                    className="w-[18px] h-[18px] mt-1 rounded-[6px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: allDone ? "#2F7D5E" : someDone ? "rgba(13,13,13,0.05)" : "#fff",
                      borderColor: allDone ? "#2F7D5E" : "rgba(13,13,13,0.25)",
                    }}
                  >
                    {allDone && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.5L4.8 8.8L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {someDone && <div className="w-1.5 h-0.5 bg-black/40 rounded-full" />}
                  </button>
                );
              })()}
              <h2 className="text-[22px] font-extrabold tracking-[-0.018em] leading-[1.2] text-black">
                {selectedEvent.block.label}
              </h2>
            </div>
            {selectedEvent.block.start_time && selectedEvent.block.end_time && (
              <div className="text-[13px] ml-7" style={{ color: "rgba(13,13,13,0.6)" }}>
                {formatTime(selectedEvent.block.start_time)} – {formatTime(selectedEvent.block.end_time)}
              </div>
            )}
            <div className="text-[12.5px] mt-0.5 ml-7" style={{ color: "rgba(13,13,13,0.4)" }}>
              {new Date(selectedEvent.dayPlan.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              }).toLowerCase()}
            </div>

            {/* Day objective */}
            <div className="mt-[18px] mb-3.5 p-3.5 rounded-[12px]" style={{ background: "rgba(13,13,13,0.03)" }}>
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase mb-1.5" style={{ color: "rgba(13,13,13,0.4)" }}>
                day objective
              </div>
              <div className="text-[13.5px] leading-[1.5]" style={{ color: "#0D0D0D" }}>
                {selectedEvent.dayPlan.objective}
              </div>
            </div>

            {/* Modal body */}
            <div className="max-h-[45vh] overflow-y-auto">
              {modalMode === "detail" && (
                <>
                  {/* Save-to-goal banner */}
                  {pendingSave && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
                      <p className="text-xs font-semibold text-amber-800">save this preference to a goal?</p>
                      <p className="text-xs text-amber-700/60 italic">"{pendingSave.feedback}"</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {goals.length > 1 && (
                          <select
                            className="px-2 py-1 border border-black/10 rounded-lg bg-white text-black text-xs focus:outline-none cursor-pointer"
                            value={pendingSave.goalId}
                            onChange={e => setPendingSave(prev => prev ? { ...prev, goalId: e.target.value } : null)}
                          >
                            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                          </select>
                        )}
                        {goals.length === 1 && <span className="text-xs text-black/40">→ <span className="text-black">{goals[0].title}</span></span>}
                        <button
                          onClick={() => {
                            if (!pendingSave) return;
                            setGoals(prev => prev.map(g =>
                              g.id === pendingSave.goalId ? { ...g, restrictions: [...g.restrictions, pendingSave.feedback] } : g
                            ));
                            setPendingSave(null);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 rounded text-xs text-white font-medium transition-colors"
                        >
                          save
                        </button>
                        <button onClick={() => setPendingSave(null)} className="text-xs text-black/40 hover:text-black transition-colors">dismiss</button>
                      </div>
                    </div>
                  )}

                  {/* Tasks */}
                  <div className="flex flex-col gap-3">
                    {(plan?.[selectedEvent.dayIdx]?.time_blocks[selectedEvent.blockIdx]?.tasks ?? selectedEvent.block.tasks).map((task, ti) => {
                      const tMode = taskModalMode[ti] ?? null;
                      const editVals = taskModalEdit[ti] ?? { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes };
                      return (
                        <div key={ti} className="group">
                          {tMode !== "edit" && (
                            <div className="flex gap-3 items-start">
                              {/* Checkbox */}
                              <button
                                onClick={() => toggleTaskComplete(selectedEvent.dayIdx, selectedEvent.blockIdx, ti)}
                                className="mt-0.5 w-[18px] h-[18px] rounded-[6px] border-[1.5px] flex items-center justify-center shrink-0 transition-colors"
                                style={{
                                  background: task.completed ? "#2F7D5E" : "#fff",
                                  borderColor: task.completed ? "#2F7D5E" : "rgba(13,13,13,0.25)",
                                }}
                              >
                                {task.completed && (
                                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                    <path d="M2.5 6.5L4.8 8.8L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                              {/* Body */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[14px] font-bold tracking-[-0.005em] transition-colors ${task.completed ? "line-through text-black/40" : "text-black"}`}>
                                    {task.title}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-black/5 border border-black/[0.08]" style={{ color: "rgba(13,13,13,0.6)" }}>
                                    {task.estimated_minutes} min
                                  </span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        setTaskModalEdit(prev => ({ ...prev, [ti]: { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes } }));
                                        setTaskModalMode(prev => ({ ...prev, [ti]: "edit" }));
                                      }}
                                      className="px-2 py-0.5 text-[10.5px] font-semibold border border-black/[0.12] rounded-full transition-colors hover:border-black/25 hover:text-black"
                                      style={{ color: "rgba(13,13,13,0.6)" }}
                                    >
                                      edit
                                    </button>
                                    <button
                                      onClick={() => setTaskModalMode(prev => ({ ...prev, [ti]: tMode === "regen" ? null : "regen" }))}
                                      className={`px-2 py-0.5 text-[10.5px] font-semibold border rounded-full transition-colors ${tMode === "regen" ? "border-black/20 bg-black/5 text-black" : "border-black/[0.12] hover:border-black/25 hover:text-black"}`}
                                      style={{ color: tMode === "regen" ? "#0D0D0D" : "rgba(13,13,13,0.6)" }}
                                    >
                                      regen
                                    </button>
                                  </div>
                                </div>
                                <p className={`text-[12.5px] leading-[1.5] mt-1 transition-colors ${task.completed ? "line-through text-black/25" : "text-black/60"}`}>
                                  {task.description}
                                </p>
                                {/* Per-task regen feedback */}
                                {tMode === "regen" && (
                                  <div className="mt-2 p-3 rounded-[12px] border border-black/[0.08]" style={{ background: "rgba(13,13,13,0.03)" }}>
                                    <textarea
                                      className="w-full resize-y min-h-[56px] border border-black/[0.12] bg-white rounded-[8px] px-3 py-2 text-[13px] leading-[1.5] text-black outline-none transition-colors focus:border-[#2F7D5E]"
                                      style={{ fontFamily: "inherit" }}
                                      placeholder="say what you'd rather practice. e.g. make it shorter, or focus on a different area."
                                      value={taskModalFeedback[ti] || ""}
                                      onChange={e => setTaskModalFeedback(prev => ({ ...prev, [ti]: e.target.value }))}
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={() => regenerateSelectedTask(ti)}
                                        disabled={taskModalRegen[ti]}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[12px] font-semibold rounded-full hover:bg-black/85 disabled:opacity-50 transition-colors"
                                      >
                                        {taskModalRegen[ti] && <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />}
                                        {taskModalRegen[ti] ? "regenerating…" : "regenerate"}
                                      </button>
                                      <button onClick={() => setTaskModalMode(prev => ({ ...prev, [ti]: null }))} className="text-[12px] text-black/40 hover:text-black transition-colors">cancel</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Inline edit */}
                          {tMode === "edit" && (
                            <div className="flex flex-col gap-2 p-3 rounded-[12px] border border-black/[0.08]" style={{ background: "rgba(13,13,13,0.02)" }}>
                              <input
                                className="w-full px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/15 placeholder:text-black/25"
                                value={editVals.title}
                                onChange={e => setTaskModalEdit(prev => ({ ...prev, [ti]: { ...editVals, title: e.target.value } }))}
                                placeholder="task title"
                              />
                              <textarea
                                className="w-full px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-xs text-black/60 focus:outline-none focus:ring-1 focus:ring-black/15 resize-none min-h-[50px] placeholder:text-black/25"
                                value={editVals.description}
                                onChange={e => setTaskModalEdit(prev => ({ ...prev, [ti]: { ...editVals, description: e.target.value } }))}
                                placeholder="description"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="number" min={1}
                                  className="w-16 px-2 py-1.5 border border-black/10 rounded-lg bg-white text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/15"
                                  value={editVals.estimated_minutes}
                                  onChange={e => setTaskModalEdit(prev => ({ ...prev, [ti]: { ...editVals, estimated_minutes: parseInt(e.target.value) || 0 } }))}
                                />
                                <span className="text-xs text-black/35">min</span>
                                <div className="flex gap-2 ml-auto">
                                  <button onClick={() => saveSelectedTaskEdit(ti)} className="px-2.5 py-1 bg-black text-white hover:bg-black/80 rounded-full text-xs font-medium transition-colors">save</button>
                                  <button onClick={() => { setTaskModalMode(prev => ({ ...prev, [ti]: null })); setTaskModalEdit(prev => { const n = { ...prev }; delete n[ti]; return n; }); }} className="text-xs text-black/40 hover:text-black transition-colors">cancel</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Reschedule form (inline) */}
                  {modalMode === "detail" && (
                    <div id="resched-area" />
                  )}
                </>
              )}

              {/* Regen day */}
              {modalMode === "regen" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px]" style={{ color: "rgba(13,13,13,0.4)" }}>
                    regenerate all blocks for{" "}
                    <span className="text-black font-semibold">
                      {new Date(selectedEvent.dayPlan.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toLowerCase()}
                    </span>.
                  </p>
                  <textarea
                    className="p-2.5 border border-black/[0.12] rounded-[12px] text-black text-sm w-full min-h-[80px] resize-y focus:outline-none transition-colors placeholder:text-black/25"
                    style={{ background: "rgba(13,13,13,0.03)", fontFamily: "inherit" }}
                    placeholder="optional feedback (e.g. make it harder, focus on barre chords, shorter session…)"
                    value={regenFeedback}
                    onChange={(e) => setRegenFeedback(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-black text-white rounded-full text-[12px] font-semibold hover:bg-black/85 disabled:opacity-60 transition-colors" onClick={regenerateDay} disabled={regenLoading}>
                      {regenLoading ? "regenerating…" : "regenerate"}
                    </button>
                    <button className="px-4 py-2 text-[12px] text-black/40 hover:text-black transition-colors" onClick={() => setModalMode("detail")}>back</button>
                  </div>
                </div>
              )}

              {/* Regen block */}
              {modalMode === "regen-block" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px]" style={{ color: "rgba(13,13,13,0.4)" }}>
                    regenerate only the <span className="text-black font-semibold">"{selectedEvent.block.label}"</span> block.
                  </p>
                  <textarea
                    className="p-2.5 border border-black/[0.12] rounded-[12px] text-black text-sm w-full min-h-[80px] resize-y focus:outline-none transition-colors placeholder:text-black/25"
                    style={{ background: "rgba(13,13,13,0.03)", fontFamily: "inherit" }}
                    placeholder="optional feedback (e.g. less weight, more theory, skip warm-up…)"
                    value={regenBlockFeedback}
                    onChange={(e) => setRegenBlockFeedback(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-[12px] font-semibold hover:bg-black/85 disabled:opacity-60 transition-colors"
                      onClick={regenerateSelectedBlock} disabled={regenBlockLoading}
                    >
                      {regenBlockLoading && <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />}
                      {regenBlockLoading ? "regenerating…" : "regenerate block"}
                    </button>
                    <button className="px-4 py-2 text-[12px] text-black/40 hover:text-black transition-colors" onClick={() => setModalMode("detail")}>back</button>
                  </div>
                </div>
              )}

              {/* Reschedule */}
              {modalMode === "reschedule" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px]" style={{ color: "rgba(13,13,13,0.4)" }}>move this block to a different date or time. the duration stays the same.</p>
                  <div className="flex flex-wrap gap-2.5 p-3 rounded-[12px] border border-black/[0.08]" style={{ background: "rgba(13,13,13,0.03)" }}>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "rgba(13,13,13,0.4)" }}>date</label>
                      <input
                        type="date"
                        className="border border-black/[0.12] bg-white rounded-[8px] px-2.5 py-2 text-[13px] text-black outline-none focus:border-[#2F7D5E]"
                        value={rsDate}
                        onChange={(e) => setRsDate(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "rgba(13,13,13,0.4)" }}>start</label>
                      <select
                        className="border border-black/[0.12] bg-white rounded-[8px] px-2.5 py-2 text-[13px] text-black outline-none focus:border-[#2F7D5E] cursor-pointer"
                        value={rsStart}
                        onChange={(e) => setRsStart(e.target.value)}
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const h = Math.floor(i / 2);
                          const m = i % 2 === 0 ? "00" : "30";
                          const value = `${String(h).padStart(2, "0")}:${m}`;
                          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                          const ampm = h < 12 ? "AM" : "PM";
                          return <option key={value} value={value}>{`${hour12}:${m} ${ampm}`}</option>;
                        })}
                      </select>
                    </div>
                    {selectedEvent?.block.start_time && selectedEvent?.block.end_time && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: "rgba(13,13,13,0.4)" }}>duration</label>
                        <span className="border border-black/[0.08] rounded-[8px] px-2.5 py-2 text-[13px]" style={{ background: "rgba(13,13,13,0.03)", color: "rgba(13,13,13,0.35)" }}>
                          {timeToMinutes(selectedEvent.block.end_time) - timeToMinutes(selectedEvent.block.start_time)} min
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-[#2F7D5E] text-white rounded-full text-[12px] font-semibold hover:bg-[#1F5E46] transition-colors" onClick={applyReschedule}>save</button>
                    <button className="px-4 py-2 text-[12px] text-black/40 hover:text-black transition-colors" onClick={() => setModalMode("detail")}>back</button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            {modalMode === "detail" && (
              <div className="flex items-center gap-2 mt-3.5 pt-3.5 border-t border-black/[0.08] flex-wrap">
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold rounded-full border border-black/[0.12] bg-white transition-all hover:border-black/25 hover:text-black"
                  style={{ color: "rgba(13,13,13,0.6)" }}
                  onClick={() => setModalMode("regen-block")}
                >
                  ↻ regenerate block
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold rounded-full border border-black/[0.12] bg-white transition-all hover:border-black/25 hover:text-black"
                  style={{ color: "rgba(13,13,13,0.6)" }}
                  onClick={() => setModalMode("regen")}
                >
                  ↻ regenerate day
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold rounded-full border border-black/[0.12] bg-white transition-all hover:border-black/25 hover:text-black"
                  style={{ color: "rgba(13,13,13,0.6)" }}
                  onClick={openReschedule}
                >
                  ⇄ reschedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
