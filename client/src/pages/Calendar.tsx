import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { DayPlan, TimeBlock } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE = import.meta.env.VITE_API_BASE;

// ---- Grid constants ----
const HOUR_HEIGHT = 64;
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function calcEndTime(startTime: string, tasks: { estimated_minutes: number }[]): string {
  const totalMins = tasks.reduce((s, t) => s + t.estimated_minutes, 0);
  const [h, m] = startTime.split(":").map(Number);
  const endMins = h * 60 + m + totalMins;
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
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

function formatViewLabel(view: CalendarView, viewDate: Date): string {
  if (view === "day") {
    return viewDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "month") {
    return viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const start = getWeekStart(viewDate);
  const end = addDays(start, 6);
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
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
  const { goals, setGoals, schedule, plan, setPlan } = useApp();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => { document.title = "Calendar — OnTrack"; }, []);

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
  // Per-task modal state (key = task index)
  const [taskModalMode, setTaskModalMode] = useState<Record<number, "regen" | "edit" | null>>({});
  const [taskModalFeedback, setTaskModalFeedback] = useState<Record<number, string>>({});
  const [taskModalRegen, setTaskModalRegen] = useState<Record<number, boolean>>({});
  const [taskModalEdit, setTaskModalEdit] = useState<Record<number, { title: string; description: string; estimated_minutes: number }>>({});
  // Save-to-goal prompt
  const [pendingSave, setPendingSave] = useState<{ feedback: string; goalId: string } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const weekDaysRef = useRef<Date[]>([]);
  const viewRef = useRef(view);
  const today = toDateStr(new Date());

  // Scroll to 7 AM when switching to timed views
  useEffect(() => {
    if ((view === "week" || view === "day") && gridRef.current) {
      gridRef.current.scrollTop = (7 - START_HOUR) * HOUR_HEIGHT;
    }
  }, [view]);

  // Drag-to-reschedule pointer events
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
        // No meaningful movement — treat as click, open detail modal
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

  // Navigation
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
      const token = await getAccessTokenSilently().catch(() => null);
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
      if (planWithIds.length > 0) {
        setViewDate(new Date(planWithIds[0].date + "T00:00:00"));
      }
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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data) {
        const newDay: DayPlan = {
          ...data,
          time_blocks: (data.time_blocks || []).map((b: TimeBlock) => ({
            ...b,
            id: crypto.randomUUID(),
          })),
        };
        setPlan((prev) => prev!.map((d, i) => (i === dayIdx ? newDay : d)));
      }
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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
      const newBlock = data.time_blocks?.[0];
      if (newBlock) {
        const endTime = block.start_time ? calcEndTime(block.start_time, newBlock.tasks) : block.end_time;
        const mergedBlock = { ...block, tasks: newBlock.tasks, end_time: endTime, id: crypto.randomUUID() };
        setPlan(prev => prev!.map((d, di) =>
          di !== dayIdx ? d : {
            ...d,
            time_blocks: d.time_blocks.map((b, bi) =>
              bi === blockIdx ? mergedBlock : b
            ),
          }
        ));
        setSelectedEvent(prev => prev ? { ...prev, block: { ...mergedBlock, id: prev.block.id } } : null);
      }
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
          di !== dayIdx ? d : {
            ...d,
            time_blocks: d.time_blocks.map((b, bi) => bi === blockIdx ? updatedBlock : b),
          }
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
      di !== dayIdx ? d : {
        ...d,
        time_blocks: d.time_blocks.map((b, bi) => bi === blockIdx ? updatedBlock : b),
      }
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
              tasks: b.tasks.map((t, ti) =>
                ti !== taskIdx ? t : { ...t, completed: !t.completed }
              ),
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
          bi !== blockIdx ? b : {
            ...b,
            tasks: b.tasks.map(t => ({ ...t, completed: !allDone })),
          }
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
    const newStartMins = timeToMinutes(rsStart);
    const updatedBlock = {
      ...block,
      start_time: rsStart,
      end_time: minsToTime(newStartMins + durationMins),
    };
    if (rsDate === plan[dayIdx].date) {
      setPlan((prev) =>
        prev!.map((d, di) =>
          di === dayIdx
            ? { ...d, time_blocks: d.time_blocks.map((b, bi) => (bi === blockIdx ? updatedBlock : b)) }
            : d
        )
      );
    } else {
      let newPlan = plan
        .map((d, di) =>
          di === dayIdx
            ? { ...d, time_blocks: d.time_blocks.filter((_, bi) => bi !== blockIdx) }
            : d
        )
        .filter((d) => d.time_blocks.length > 0);
      const targetIdx = newPlan.findIndex((d) => d.date === rsDate);
      if (targetIdx >= 0) {
        newPlan[targetIdx] = {
          ...newPlan[targetIdx],
          time_blocks: [...newPlan[targetIdx].time_blocks, updatedBlock],
        };
      } else {
        newPlan.push({
          date: rsDate,
          objective: `Rescheduled: ${updatedBlock.label}`,
          time_blocks: [updatedBlock],
        });
        newPlan.sort((a, b) => a.date.localeCompare(b.date));
      }
      setPlan(newPlan);
    }
    setSelectedEvent(null);
  };

  // Keep refs in sync for use inside pointer event handlers
  viewRef.current = view;

  // Build date → plan lookup
  const planByDate: Record<string, { dayPlan: DayPlan; dayIdx: number }> = {};
  if (plan) {
    plan.forEach((dayPlan, dayIdx) => {
      planByDate[dayPlan.date] = { dayPlan, dayIdx };
    });
  }

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
      block,
      dayPlan,
      dayIdx,
      blockIdx,
      offsetMins,
      originalDate: dateStr,
      previewDate: dateStr,
      previewStartMins: timeToMinutes(block.start_time),
      active: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    setDrag(state);
    dragRef.current = state;
  };

  // Current time
  const now = new Date();
  const currentTimeTop = ((now.getHours() + now.getMinutes() / 60) - START_HOUR) * HOUR_HEIGHT;

  // ---- Shared: time grid column renderer ----
  const renderTimeColumn = (d: Date, widthClass: string) => {
    const dateStr = toDateStr(d);
    const entry = planByDate[dateStr];
    const isToday = dateStr === today;

    const timedBlocks: { block: TimeBlock; blockIdx: number }[] = [];
    const untimedBlocks: { block: TimeBlock; blockIdx: number }[] = [];

    if (entry) {
      entry.dayPlan.time_blocks.forEach((block, blockIdx) => {
        if (block.start_time && block.end_time) {
          timedBlocks.push({ block, blockIdx });
        } else {
          untimedBlocks.push({ block, blockIdx });
        }
      });
    }

    return (
      <div key={dateStr} className={`${widthClass} relative border-l border-gray-700/40`}>
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-gray-800/70"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
          />
        ))}
        {HOURS.map((h) => (
          <div
            key={`${h}-half`}
            className="absolute left-0 right-0 border-t border-gray-800/30"
            style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
          />
        ))}

        {/* ---- Schedule overlays ---- */}
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
              {/* Free time — subtle green tint */}
              {freeSlots.map((slot, i) => {
                const pos = overlayPos(slot.start, slot.end);
                if (!pos) return null;
                return (
                  <div
                    key={`free-${i}`}
                    className="absolute left-0 right-0 bg-emerald-500/[0.08] pointer-events-none z-[1]"
                    style={pos}
                  />
                );
              })}

              {/* Recurring blocked time — red tint with label */}
              {recurringForDay.map((rb) => {
                const pos = overlayPos(rb.start_time, rb.end_time);
                if (!pos) return null;
                const h = parseFloat(pos.height);
                return (
                  <div
                    key={`rb-${rb.id}`}
                    className="absolute left-0 right-0 bg-red-900/30 border-l-2 border-red-700/50 pointer-events-none z-[2] overflow-hidden"
                    style={pos}
                  >
                    {h >= 18 && (
                      <p className="text-[9px] text-red-400/80 font-medium px-1.5 pt-0.5 truncate leading-tight select-none">
                        {rb.label}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Specific blocked dates */}
              {specificForDay.map((sb) => {
                if (sb.all_day) {
                  return (
                    <div
                      key={`sb-${sb.id}`}
                      className="absolute inset-0 bg-red-900/25 border-l-2 border-red-700/50 pointer-events-none z-[2] overflow-hidden"
                    >
                      <p className="text-[9px] text-red-400/80 font-medium px-1.5 pt-1 truncate leading-tight select-none">
                        {sb.label || "Blocked"}
                      </p>
                    </div>
                  );
                }
                const pos = overlayPos(sb.start_time, sb.end_time);
                if (!pos) return null;
                const h = parseFloat(pos.height);
                return (
                  <div
                    key={`sb-${sb.id}`}
                    className="absolute left-0 right-0 bg-red-900/30 border-l-2 border-red-700/50 pointer-events-none z-[2] overflow-hidden"
                    style={pos}
                  >
                    {h >= 18 && (
                      <p className="text-[9px] text-red-400/80 font-medium px-1.5 pt-0.5 truncate leading-tight select-none">
                        {sb.label || "Blocked"}
                      </p>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}

        {isToday && <div className="absolute inset-0 bg-indigo-950/10 pointer-events-none" />}
        {isToday && currentTimeTop > 0 && currentTimeTop < HOURS.length * HOUR_HEIGHT && (
          <div
            className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
            style={{ top: `${currentTimeTop}px` }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
            <div className="flex-1 h-px bg-red-500" />
          </div>
        )}
        {timedBlocks.map(({ block, blockIdx }) => {
          const startMins = Math.max(timeToMinutes(block.start_time!), START_HOUR * 60);
          const endMins = Math.min(timeToMinutes(block.end_time!), END_HOUR * 60);
          const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 22);
          const isSelected =
            selectedEvent?.dayIdx === entry!.dayIdx && selectedEvent?.blockIdx === blockIdx;
          const isDragging = drag?.active && drag.dayIdx === entry!.dayIdx && drag.blockIdx === blockIdx;
          const allDone = block.tasks.length > 0 && block.tasks.every((t) => t.completed);
          return (
            <div
              key={block.id}
              className={`absolute left-1 right-1 rounded-md px-1.5 py-1 text-left overflow-hidden select-none cursor-grab transition-opacity ${
                isSelected
                  ? `ring-2 z-10 ${allDone ? "bg-emerald-700 ring-emerald-400/40" : "bg-indigo-500 ring-indigo-300/40"}`
                  : allDone
                    ? "bg-emerald-800/80 hover:bg-emerald-700/80 z-[5]"
                    : "bg-indigo-600/85 hover:bg-indigo-500 z-[5]"
              } ${isDragging ? "opacity-30" : ""}`}
              style={{ top: `${top}px`, height: `${height}px` }}
              onPointerDown={(e) =>
                handleBlockPointerDown(e, block, entry!.dayPlan, entry!.dayIdx, blockIdx, dateStr)
              }
            >
              <p className="text-[11px] font-semibold text-white leading-tight truncate">{block.label}</p>
              {height > 30 && block.start_time && block.end_time && (
                <p className="text-[10px] text-indigo-200 leading-tight">
                  {formatTime(block.start_time)} – {formatTime(block.end_time)}
                </p>
              )}
              {height > 30 && block.tasks.length > 0 && (() => {
                const done = block.tasks.filter((t) => t.completed).length;
                const total = block.tasks.length;
                if (done === 0) return null;
                return (
                  <p className={`text-[9px] leading-tight mt-0.5 ${done === total ? "text-emerald-300" : "text-indigo-300/70"}`}>
                    {done === total ? "✓ Done" : `${done}/${total} done`}
                  </p>
                );
              })()}
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
              className="absolute left-1 right-1 rounded-md px-1.5 py-1 bg-indigo-500/30 border-2 border-indigo-400 border-dashed z-20 pointer-events-none"
              style={{ top: `${ghostTop}px`, height: `${ghostHeight}px` }}
            >
              <p className="text-[11px] font-semibold text-indigo-200 leading-tight truncate">{drag.block.label}</p>
              {ghostHeight > 30 && (
                <p className="text-[10px] text-indigo-300 leading-tight">
                  {formatTime(minsToTime(ghostStart))} – {formatTime(minsToTime(ghostEnd))}
                </p>
              )}
            </div>
          );
        })()}
        {untimedBlocks.length > 0 && (
          <div className="absolute top-2 left-1 right-1 flex flex-col gap-0.5 z-[5]">
            {untimedBlocks.map(({ block, blockIdx }) => (
              <button
                key={block.id}
                className={`rounded px-1.5 py-0.5 text-left transition-colors ${
                  selectedEvent?.dayIdx === entry!.dayIdx && selectedEvent?.blockIdx === blockIdx
                    ? "bg-violet-500"
                    : "bg-violet-600/80 hover:bg-violet-500"
                }`}
                onClick={() => {
                  setSelectedEvent({ dayPlan: entry!.dayPlan, dayIdx: entry!.dayIdx, block, blockIdx });
                  setModalMode("detail");
                }}
              >
                <p className="text-[10px] font-medium text-white truncate">{block.label}</p>
                {block.tasks.length > 0 && (() => {
                  const done = block.tasks.filter((t) => t.completed).length;
                  const total = block.tasks.length;
                  if (done === 0) return null;
                  return (
                    <p className={`text-[9px] leading-tight ${done === total ? "text-emerald-300" : "text-violet-300/70"}`}>
                      {done === total ? "✓ Done" : `${done}/${total}`}
                    </p>
                  );
                })()}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---- Time gutter ----
  const renderTimeGutter = () => (
    <div className="w-14 shrink-0 relative select-none">
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute right-2 text-[10px] text-gray-600 tabular-nums"
          style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT - 7}px` }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  );

  // ---- Empty state ----
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-xl font-bold mb-2">No goals set up yet</h2>
        <p className="text-gray-400 mb-6">Create a goal first, then generate your plan.</p>
        <Link
          to="/goals/new"
          className="px-5 py-2.5 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 transition-colors"
        >
          Create a goal
        </Link>
      </div>
    );
  }

  // ---- Derived ----
  const weekStart = getWeekStart(viewDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  weekDaysRef.current = weekDays;
  const monthGrid = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth());

  return (
    <>
      <div
        className="flex flex-col rounded-xl border border-gray-700/60 overflow-hidden bg-gray-950"
        style={{ height: "calc(100vh - 120px)" }}
      >
        {/* ---- Toolbar ---- */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700/60 bg-gray-900/80 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-lg leading-none"
          >
            ‹
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-lg leading-none"
          >
            ›
          </button>
          <button
            onClick={() => { setViewDate(new Date()); }}
            className="px-2.5 py-1 text-xs border border-gray-600 rounded hover:bg-gray-700 text-gray-300 transition-colors"
          >
            Today
          </button>
          <h2 className="text-sm font-semibold text-white flex-1 ml-1">
            {formatViewLabel(view, viewDate)}
          </h2>

          {error && <span className="text-xs text-red-400 mr-1">{error}</span>}

          {/* View toggle */}
          <div className="flex border border-gray-600 rounded-lg overflow-hidden text-xs">
            {(["day", "week", "month"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 capitalize transition-colors ${
                  view === v
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            className="ml-1 px-3 py-1.5 text-xs border border-gray-600 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-colors"
            onClick={generate}
            disabled={loading}
          >
            {loading ? "Generating…" : plan ? "Regenerate All" : "Generate Plan"}
          </button>
        </div>

        {/* ---- Day-of-week header (day + week views) ---- */}
        {view !== "month" && (
          <div className="flex shrink-0 border-b border-gray-700/60 bg-gray-900/60">
            <div className="w-14 shrink-0" />
            {(view === "week" ? weekDays : [viewDate]).map((d, i) => {
              const dateStr = toDateStr(d);
              const isToday = dateStr === today;
              const hasPlan = !!planByDate[dateStr];
              const label = view === "week" ? DAY_LABELS[i] : d.toLocaleDateString("en-US", { weekday: "short" });
              return (
                <button
                  key={i}
                  className="flex-1 flex flex-col items-center py-2 border-l border-gray-700/40 hover:bg-gray-800/40 transition-colors"
                  onClick={() => goToDay(d)}
                  title="Switch to day view"
                >
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest ${
                      isToday ? "text-indigo-400" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`mt-0.5 text-base font-bold w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                      isToday ? "bg-indigo-600 text-white" : hasPlan ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ---- Content area ---- */}
        <div className="flex-1 min-h-0 relative">

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/70 gap-3">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Generating your plan…</span>
            </div>
          )}

          {/* No-plan overlay */}
          {!plan && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-8 text-center shadow-xl">
                <h3 className="text-base font-semibold mb-1.5">No plan yet</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Generate a weekly plan from your goals and schedule.
                </p>
                <button
                  className="px-5 py-2.5 bg-indigo-600 rounded-lg text-sm text-white hover:bg-indigo-700 transition-colors"
                  onClick={generate}
                >
                  Generate Plan
                </button>
              </div>
            </div>
          )}

          {/* ==== WEEK VIEW ==== */}
          {view === "week" && (
            <div ref={gridRef} className="h-full overflow-y-auto overflow-x-hidden">
              <div className="flex" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                {renderTimeGutter()}
                {weekDays.map((d) => renderTimeColumn(d, "flex-1"))}
              </div>
            </div>
          )}

          {/* ==== DAY VIEW ==== */}
          {view === "day" && (
            <div ref={gridRef} className="h-full overflow-y-auto overflow-x-hidden">
              <div className="flex" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
                {renderTimeGutter()}
                {renderTimeColumn(viewDate, "flex-1")}
              </div>
            </div>
          )}

          {/* ==== MONTH VIEW ==== */}
          {view === "month" && (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 shrink-0 border-b border-gray-700/60 bg-gray-900/60">
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Week rows */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {monthGrid.map((week, wi) => (
                  <div
                    key={wi}
                    className="flex-1 grid grid-cols-7 border-t border-gray-700/30 min-h-0"
                  >
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
                          className={`border-r border-gray-700/30 p-1.5 overflow-hidden flex flex-col gap-0.5 ${
                            di === 0 ? "border-l-0" : ""
                          } ${isCurrentMonth ? "" : "opacity-40"}`}
                        >
                          {/* Day number */}
                          <button
                            className="self-start"
                            onClick={() => goToDay(d)}
                            title="View day"
                          >
                            <span
                              className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                                isToday
                                  ? "bg-indigo-600 text-white"
                                  : "text-gray-400 hover:text-white hover:bg-gray-700"
                              }`}
                            >
                              {d.getDate()}
                            </span>
                          </button>

                          {/* Event chips */}
                          {allBlocks.slice(0, MAX_CHIPS).map((block) => (
                            <button
                              key={block.id}
                              className="w-full rounded px-1 py-0.5 text-left bg-indigo-600/75 hover:bg-indigo-500 transition-colors overflow-hidden"
                              onClick={() => {
                                setSelectedEvent({
                                  dayPlan: entry!.dayPlan,
                                  dayIdx: entry!.dayIdx,
                                  block,
                                  blockIdx: entry!.dayPlan.time_blocks.indexOf(block),
                                });
                                setModalMode("detail");
                              }}
                            >
                              <p className="text-[10px] font-medium text-white truncate leading-tight">
                                {block.start_time ? formatTime(block.start_time) + " " : ""}
                                {block.label}
                              </p>
                            </button>
                          ))}
                          {allBlocks.length > MAX_CHIPS && (
                            <button
                              className="text-[10px] text-gray-500 hover:text-gray-300 text-left px-1 transition-colors"
                              onClick={() => goToDay(d)}
                            >
                              +{allBlocks.length - MAX_CHIPS} more
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Event detail modal ---- */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedEvent(null); setModalMode("detail"); setTaskModalMode({}); setTaskModalEdit({}); setPendingSave(null); } }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => { setSelectedEvent(null); setModalMode("detail"); setTaskModalMode({}); setTaskModalEdit({}); setPendingSave(null); }} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-700/80">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  {(() => {
                    const tasks = plan?.[selectedEvent.dayIdx]?.time_blocks[selectedEvent.blockIdx]?.tasks ?? selectedEvent.block.tasks;
                    const allDone = tasks.length > 0 && tasks.every(t => t.completed);
                    const someDone = !allDone && tasks.some(t => t.completed);
                    return (
                      <button
                        onClick={() => toggleBlockComplete(selectedEvent.dayIdx, selectedEvent.blockIdx)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          allDone ? "bg-emerald-600 border-emerald-600" : someDone ? "border-indigo-500 bg-indigo-900/40" : "border-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {allDone && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {someDone && <div className="w-1.5 h-0.5 bg-indigo-400 rounded-full" />}
                      </button>
                    );
                  })()}
                  <h3 className="font-semibold text-white leading-tight">{selectedEvent.block.label}</h3>
                </div>
                {selectedEvent.block.start_time && selectedEvent.block.end_time && (
                  <p className="text-sm text-gray-400 ml-4">
                    {formatTime(selectedEvent.block.start_time)} – {formatTime(selectedEvent.block.end_time)}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1 ml-4">
                  {new Date(selectedEvent.dayPlan.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => { setSelectedEvent(null); setModalMode("detail"); setTaskModalMode({}); setTaskModalEdit({}); setPendingSave(null); }}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 max-h-[55vh] overflow-y-auto">
              {modalMode === "detail" && (
                <>
                  {/* Save-to-goal banner */}
                  {pendingSave && (
                    <div className="mb-4 rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 flex flex-col gap-2">
                      <p className="text-xs font-semibold text-amber-300">Save this preference to a goal?</p>
                      <p className="text-xs text-amber-200/60 italic">"{pendingSave.feedback}"</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {goals.length > 1 && (
                          <select
                            className="px-2 py-1 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs focus:outline-none cursor-pointer"
                            value={pendingSave.goalId}
                            onChange={e => setPendingSave(prev => prev ? { ...prev, goalId: e.target.value } : null)}
                          >
                            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                          </select>
                        )}
                        {goals.length === 1 && <span className="text-xs text-gray-400">→ <span className="text-white">{goals[0].title}</span></span>}
                        <button
                          onClick={() => {
                            if (!pendingSave) return;
                            setGoals(prev => prev.map(g =>
                              g.id === pendingSave.goalId
                                ? { ...g, restrictions: [...g.restrictions, pendingSave.feedback] }
                                : g
                            ));
                            setPendingSave(null);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 rounded text-xs text-white font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button onClick={() => setPendingSave(null)} className="text-xs text-gray-500 hover:text-white transition-colors">Dismiss</button>
                      </div>
                    </div>
                  )}

                  <div className="mb-4 p-3 rounded-lg bg-gray-800/60 border border-gray-700/50">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                      Day Objective
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">{selectedEvent.dayPlan.objective}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(plan?.[selectedEvent.dayIdx]?.time_blocks[selectedEvent.blockIdx]?.tasks ?? selectedEvent.block.tasks).map((task, ti) => {
                      const tMode = taskModalMode[ti] ?? null;
                      const editVals = taskModalEdit[ti] ?? { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes };
                      return (
                        <div key={ti} className="group">
                          {tMode !== "edit" && (
                            <div className={`border-l-2 pl-3 transition-colors ${task.completed ? "border-emerald-600/60" : "border-indigo-500/60"}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={() => toggleTaskComplete(selectedEvent.dayIdx, selectedEvent.blockIdx, ti)}
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${task.completed ? "bg-emerald-600 border-emerald-600" : "border-gray-500 hover:border-indigo-400"}`}
                                >
                                  {task.completed && (
                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </button>
                                <span className={`text-sm font-medium flex-1 transition-colors ${task.completed ? "text-gray-500 line-through" : "text-white"}`}>{task.title}</span>
                                <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded tabular-nums">{task.estimated_minutes} min</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setTaskModalEdit(prev => ({ ...prev, [ti]: { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes } }));
                                      setTaskModalMode(prev => ({ ...prev, [ti]: "edit" }));
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setTaskModalMode(prev => ({ ...prev, [ti]: tMode === "regen" ? null : "regen" }))}
                                    className={`px-1.5 py-0.5 text-[10px] border rounded transition-colors ${tMode === "regen" ? "border-indigo-600/50 text-indigo-400" : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"}`}
                                  >
                                    Regen
                                  </button>
                                </div>
                              </div>
                              <p className={`text-xs mt-0.5 leading-relaxed transition-colors ${task.completed ? "text-gray-600 line-through" : "text-gray-400"}`}>{task.description}</p>
                            </div>
                          )}

                          {/* Inline edit */}
                          {tMode === "edit" && (
                            <div className="flex flex-col gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                              <input
                                className="w-full px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                value={editVals.title}
                                onChange={e => setTaskModalEdit(prev => ({ ...prev, [ti]: { ...editVals, title: e.target.value } }))}
                                placeholder="Task title"
                              />
                              <textarea
                                className="w-full px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none min-h-[50px]"
                                value={editVals.description}
                                onChange={e => setTaskModalEdit(prev => ({ ...prev, [ti]: { ...editVals, description: e.target.value } }))}
                                placeholder="Description"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="number" min={1}
                                  className="w-16 px-2 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                  value={editVals.estimated_minutes}
                                  onChange={e => setTaskModalEdit(prev => ({ ...prev, [ti]: { ...editVals, estimated_minutes: parseInt(e.target.value) || 0 } }))}
                                />
                                <span className="text-xs text-gray-500">min</span>
                                <div className="flex gap-2 ml-auto">
                                  <button onClick={() => saveSelectedTaskEdit(ti)} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs text-white font-medium transition-colors">Save</button>
                                  <button onClick={() => { setTaskModalMode(prev => ({ ...prev, [ti]: null })); setTaskModalEdit(prev => { const n = { ...prev }; delete n[ti]; return n; }); }} className="px-2.5 py-1 text-xs text-gray-500 hover:text-white transition-colors">Cancel</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Per-task regen */}
                          {tMode === "regen" && (
                            <div className="mt-1 ml-3 p-2.5 bg-indigo-950/30 border border-indigo-900/40 rounded-lg flex flex-col gap-2">
                              <textarea
                                className="w-full px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none min-h-[50px] placeholder:text-gray-600"
                                placeholder="e.g. Make it easier, less weight, different focus…"
                                value={taskModalFeedback[ti] || ""}
                                onChange={e => setTaskModalFeedback(prev => ({ ...prev, [ti]: e.target.value }))}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => regenerateSelectedTask(ti)}
                                  disabled={taskModalRegen[ti]}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs text-white font-medium disabled:opacity-50 transition-colors"
                                >
                                  {taskModalRegen[ti] && <span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />}
                                  {taskModalRegen[ti] ? "Regenerating…" : "Regenerate"}
                                </button>
                                <button onClick={() => setTaskModalMode(prev => ({ ...prev, [ti]: null }))} className="text-xs text-gray-500 hover:text-white transition-colors">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {modalMode === "regen" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-400">
                    Regenerate all blocks for{" "}
                    <span className="text-white font-medium">
                      {new Date(selectedEvent.dayPlan.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    .
                  </p>
                  <textarea
                    className="p-2.5 border border-gray-600 rounded-lg bg-gray-800 text-white text-sm w-full min-h-[80px] resize-y focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Optional feedback (e.g. make it harder, focus on barre chords, shorter session…)"
                    value={regenFeedback}
                    onChange={(e) => setRegenFeedback(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 bg-indigo-600 rounded-lg text-sm text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                      onClick={regenerateDay}
                      disabled={regenLoading}
                    >
                      {regenLoading ? "Regenerating…" : "Regenerate"}
                    </button>
                    <button
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      onClick={() => setModalMode("detail")}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {modalMode === "regen-block" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-400">
                    Regenerate only the <span className="text-white font-medium">"{selectedEvent.block.label}"</span> block.
                  </p>
                  <textarea
                    className="p-2.5 border border-gray-600 rounded-lg bg-gray-800 text-white text-sm w-full min-h-[80px] resize-y focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Optional feedback (e.g. less weight, more theory, skip warm-up…)"
                    value={regenBlockFeedback}
                    onChange={(e) => setRegenBlockFeedback(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                      onClick={regenerateSelectedBlock}
                      disabled={regenBlockLoading}
                    >
                      {regenBlockLoading && <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />}
                      {regenBlockLoading ? "Regenerating…" : "Regenerate block"}
                    </button>
                    <button
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      onClick={() => setModalMode("detail")}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {modalMode === "reschedule" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-400">Move this block to a different date or time. The duration stays the same.</p>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                      Date
                      <input
                        type="date"
                        className="p-2 border border-gray-600 rounded-lg bg-gray-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        value={rsDate}
                        onChange={(e) => setRsDate(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-400">
                      Start time
                      <select
                        className="p-2 border border-gray-600 rounded-lg bg-gray-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
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
                    </label>
                    {selectedEvent?.block.start_time && selectedEvent?.block.end_time && (
                      <div className="flex flex-col gap-1 text-xs text-gray-400">
                        Duration
                        <span className="p-2 border border-gray-700 rounded-lg bg-gray-800/50 text-gray-500 text-sm">
                          {timeToMinutes(selectedEvent.block.end_time) - timeToMinutes(selectedEvent.block.start_time)} min
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 bg-indigo-600 rounded-lg text-sm text-white hover:bg-indigo-700 transition-colors"
                      onClick={applyReschedule}
                    >
                      Save
                    </button>
                    <button
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      onClick={() => setModalMode("detail")}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {modalMode === "detail" && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-700/80 bg-gray-900/50 flex-wrap">
                <button
                  className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  onClick={() => setModalMode("regen-block")}
                >
                  Regenerate block
                </button>
                <button
                  className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  onClick={() => setModalMode("regen")}
                >
                  Regenerate day
                </button>
                <button
                  className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  onClick={openReschedule}
                >
                  Reschedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
