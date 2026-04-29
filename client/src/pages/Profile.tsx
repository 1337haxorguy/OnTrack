import { useState, useEffect, useRef } from "react";
import { useApp, DAYS } from "../context/AppContext";
import type { Day, Schedule } from "../context/AppContext";

// ── Grid constants ──────────────────────────────────────────
const GRID_START = 6 * 60;
const GRID_END   = 23 * 60;
const SLOT_MIN   = 30;
const NUM_SLOTS  = (GRID_END - GRID_START) / SLOT_MIN; // 34

type GridState = Record<Day, boolean[]>;

function slotToTimeStr(slotIdx: number): string {
  const total = GRID_START + slotIdx * SLOT_MIN;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function slotToLabel(slotIdx: number): string {
  const total = GRID_START + slotIdx * SLOT_MIN;
  if (total % 60 !== 0) return "";
  const h = Math.floor(total / 60);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour12}${ampm}`;
}

function freeSlotsToGrid(free_slots: Schedule["free_slots"]): GridState {
  const grid = {} as GridState;
  for (const day of DAYS) {
    grid[day] = Array(NUM_SLOTS).fill(false);
    const slots = free_slots[day] ?? [];
    for (let i = 0; i < NUM_SLOTS; i++) {
      const sStart = GRID_START + i * SLOT_MIN;
      const sEnd   = sStart + SLOT_MIN;
      for (const slot of slots) {
        const [sh, sm] = slot.start.split(":").map(Number);
        const [eh, em] = slot.end.split(":").map(Number);
        const fStart = sh * 60 + sm;
        const fEnd   = eh * 60 + em;
        if (sStart >= fStart && sEnd <= fEnd) { grid[day][i] = true; break; }
      }
    }
  }
  return grid;
}

function gridToFreeSlots(grid: GridState): Schedule["free_slots"] {
  const result: Schedule["free_slots"] = {};
  for (const day of DAYS) {
    const ranges: { start: string; end: string }[] = [];
    let rangeStart: number | null = null;
    for (let i = 0; i <= NUM_SLOTS; i++) {
      const on = i < NUM_SLOTS && grid[day][i];
      if (on && rangeStart === null) rangeStart = i;
      if (!on && rangeStart !== null) {
        ranges.push({ start: slotToTimeStr(rangeStart), end: slotToTimeStr(i) });
        rangeStart = null;
      }
    }
    if (ranges.length > 0) result[day] = ranges;
  }
  return result;
}

// Grid accent colors — design system green
const CELL_FREE    = "#2F7D5E";
const CELL_BUSY    = "#F0F0EE";
const CELL_PREVIEW = "#A8D4C0";
const CELL_ERASE   = "#FECACA";

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${m}`;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "AM" : "PM";
  return { value, label: `${hour12}:${m} ${ampm}` };
});

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 border border-black/10 rounded-xl bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/25 transition-colors cursor-pointer"
    >
      {TIMES.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

const inputCls =
  "px-3 py-2.5 border border-black/[0.12] rounded-xl bg-white text-black text-sm w-full " +
  "focus:outline-none focus:ring-2 focus:ring-black/[0.08] focus:border-black/25 " +
  "transition-colors placeholder:text-black/25";

const DAY_ABBR: Record<string, string> = {
  monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
  friday: "Fr", saturday: "Sa", sunday: "Su",
};

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/40 mb-2 px-0.5">
      {children}
    </p>
  );
}

export default function Profile() {
  const { schedule, setSchedule, dataLoaded } = useApp();
  const { timezone, free_slots, recurring_blocks, specific_blocks } = schedule;

  useEffect(() => { document.title = "Schedule — OnTrack"; }, []);

  // ── Grid state ──────────────────────────────────────────────
  const [grid, setGridState] = useState<GridState>(() => freeSlotsToGrid(free_slots));
  const gridRef = useRef<GridState>(grid);

  const setGrid = (newGrid: GridState) => {
    gridRef.current = newGrid;
    setGridState(newGrid);
  };

  const update = (patch: Partial<typeof schedule>) =>
    setSchedule((prev) => ({ ...prev, ...patch }));

  const rehydrated = useRef(false);
  useEffect(() => {
    if (dataLoaded && !rehydrated.current) {
      rehydrated.current = true;
      const newGrid = freeSlotsToGrid(free_slots);
      gridRef.current = newGrid;
      setGridState(newGrid);
    }
  }, [dataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rectangle drag ──────────────────────────────────────────
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const paintValue   = useRef(false);
  const dragStart    = useRef<{ dayIdx: number; slot: number } | null>(null);
  const dragEnd      = useRef<{ dayIdx: number; slot: number } | null>(null);
  const baseGrid     = useRef<GridState>(grid);

  const applyDomRect = (d0: number, d1: number, s0: number, s1: number) => {
    const container = gridContainerRef.current;
    if (!container) return;
    const val = paintValue.current;
    container.querySelectorAll<HTMLElement>("[data-di]").forEach((cell) => {
      const di = parseInt(cell.getAttribute("data-di")!);
      const si = parseInt(cell.getAttribute("data-si")!);
      const inRect = di >= d0 && di <= d1 && si >= s0 && si <= s1;
      if (inRect) {
        cell.style.backgroundColor = val ? CELL_FREE : CELL_BUSY;
      } else {
        cell.style.backgroundColor = baseGrid.current[DAYS[di]][si] ? CELL_FREE : CELL_BUSY;
      }
    });
  };

  const getRectFrom = (endDi: number, endSi: number) => {
    const start = dragStart.current!;
    return {
      d0: Math.min(start.dayIdx, endDi), d1: Math.max(start.dayIdx, endDi),
      s0: Math.min(start.slot, endSi),   s1: Math.max(start.slot, endSi),
    };
  };

  const handleCellPointerDown = (dayIdx: number, slotIdx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    paintValue.current = !gridRef.current[DAYS[dayIdx]][slotIdx];
    dragStart.current  = { dayIdx, slot: slotIdx };
    dragEnd.current    = { dayIdx, slot: slotIdx };
    baseGrid.current   = gridRef.current;
    applyDomRect(dayIdx, dayIdx, slotIdx, slotIdx);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !dragStart.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const di = el?.getAttribute("data-di");
    const si = el?.getAttribute("data-si");
    if (di == null || si == null) return;
    const endDi = parseInt(di);
    const endSi = parseInt(si);
    dragEnd.current = { dayIdx: endDi, slot: endSi };
    const { d0, d1, s0, s1 } = getRectFrom(endDi, endSi);
    const container = gridContainerRef.current;
    if (!container) return;
    const val = paintValue.current;
    container.querySelectorAll<HTMLElement>("[data-di]").forEach((cell) => {
      const cdi = parseInt(cell.getAttribute("data-di")!);
      const csi = parseInt(cell.getAttribute("data-si")!);
      const inRect = cdi >= d0 && cdi <= d1 && csi >= s0 && csi <= s1;
      if (inRect) {
        cell.style.backgroundColor = val ? CELL_PREVIEW : CELL_ERASE;
      } else {
        cell.style.backgroundColor = baseGrid.current[DAYS[cdi]][csi] ? CELL_FREE : CELL_BUSY;
      }
    });
  };

  useEffect(() => {
    const stop = () => {
      if (!isDragging.current || !dragStart.current) { isDragging.current = false; return; }
      const end  = dragEnd.current ?? dragStart.current;
      const { d0, d1, s0, s1 } = getRectFrom(end.dayIdx, end.slot);
      const val  = paintValue.current;
      const base = baseGrid.current;
      const newGrid = {} as GridState;
      for (const day of DAYS) newGrid[day] = [...base[day]];
      for (let di = d0; di <= d1; di++)
        for (let si = s0; si <= s1; si++)
          newGrid[DAYS[di]][si] = val;
      gridContainerRef.current?.querySelectorAll<HTMLElement>("[data-di]").forEach((el) => {
        const di = parseInt(el.getAttribute("data-di")!);
        const si = parseInt(el.getAttribute("data-si")!);
        el.style.backgroundColor = newGrid[DAYS[di]][si] ? CELL_FREE : CELL_BUSY;
      });
      setGrid(newGrid);
      update({ free_slots: gridToFreeSlots(newGrid) });
      isDragging.current = false;
      dragStart.current  = null;
      dragEnd.current    = null;
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recurring blocks form ──────────────────────────────────
  const [rbForm, setRbForm] = useState({
    label: "", days: [] as Day[], start_time: "09:00", end_time: "17:00",
  });
  const toggleRbDay = (day: Day) =>
    setRbForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  const addRecurringBlock = () => {
    if (!rbForm.label.trim() || rbForm.days.length === 0) return;
    update({ recurring_blocks: [...recurring_blocks, { ...rbForm, id: crypto.randomUUID() }] });
    setRbForm({ label: "", days: [], start_time: "09:00", end_time: "17:00" });
  };

  // ── Specific blocks form ───────────────────────────────────
  const [sbForm, setSbForm] = useState({
    label: "", date: "", all_day: true, start_time: "09:00", end_time: "10:00",
  });
  const addSpecificBlock = () => {
    if (!sbForm.date) return;
    update({
      specific_blocks: [
        ...specific_blocks,
        { ...sbForm, id: crypto.randomUUID(), label: sbForm.label || "Blocked" },
      ],
    });
    setSbForm({ label: "", date: "", all_day: true, start_time: "09:00", end_time: "10:00" });
  };

  const daySummary = (day: Day): string => {
    const count = gridRef.current[day].filter(Boolean).length;
    return count === 0 ? "" : `${count / 2}h`;
  };

  const totalFreeHours = DAYS.reduce((sum, day) => {
    return sum + gridRef.current[day].filter(Boolean).length / 2;
  }, 0);

  return (
    <div
      className="pb-24 w-full"
      style={{ fontFamily: "Epilogue, system-ui, -apple-system, sans-serif" }}
    >
      {/* ── Page header ── */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold text-black tracking-[-0.02em] leading-none mb-1.5">
            schedule
          </h1>
          <p className="text-[14px] text-black/40">
            set when you're free so the AI can plan around your life.
          </p>
        </div>
        {totalFreeHours > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#E8F1EC] text-[#1F5E46]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D5E]" />
            {totalFreeHours}h free / week
          </span>
        )}
      </div>

      <div className="flex flex-col gap-8">

        {/* ── AVAILABILITY GRID ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionHead>availability</SectionHead>
            <div className="flex items-center gap-4">
              {/* Timezone inline */}
              <input
                className="px-3 py-1.5 border border-black/[0.12] rounded-xl bg-white text-black text-[12px] w-48 focus:outline-none focus:ring-2 focus:ring-black/[0.08] focus:border-black/25 transition-colors placeholder:text-black/25"
                placeholder="e.g. America/New_York"
                value={timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                title="Timezone"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/8 p-6">
            <div
              ref={gridContainerRef}
              className="select-none touch-none overflow-x-auto"
              onPointerMove={handleContainerPointerMove}
            >
              <div style={{ minWidth: 320 }}>

                {/* Day headers */}
                <div className="flex mb-2" style={{ paddingLeft: 40 }}>
                  {DAYS.map(day => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[11px] font-semibold text-black/45 uppercase tracking-wider">
                        {DAY_ABBR[day]}
                      </span>
                      <span
                        className="text-[9px] font-semibold tabular-nums h-3"
                        style={{ color: "#1F5E46", opacity: daySummary(day) ? 1 : 0 }}
                      >
                        {daySummary(day)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Grid body */}
                <div
                  style={{
                    marginLeft: 40,
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.10)",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  {Array.from({ length: NUM_SLOTS }, (_, slotIdx) => {
                    const label = slotToLabel(slotIdx);
                    const isHour = label !== "";
                    return (
                      <div key={slotIdx} className="flex relative" style={{ height: 20 }}>
                        {DAYS.map((day, di) => {
                          const selected = grid[day][slotIdx];
                          return (
                            <div
                              key={day}
                              data-di={di}
                              data-si={slotIdx}
                              className="flex-1 cursor-crosshair"
                              style={{
                                backgroundColor: selected ? CELL_FREE : CELL_BUSY,
                                borderRight: di < DAYS.length - 1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                                borderTop: !isHour ? "1px solid rgba(0,0,0,0.04)" : "none",
                              }}
                              onPointerDown={handleCellPointerDown(di, slotIdx)}
                            />
                          );
                        })}
                        {isHour && slotIdx > 0 && (
                          <div
                            className="absolute pointer-events-none inset-x-0 top-0"
                            style={{ height: 1, backgroundColor: "rgba(0,0,0,0.12)" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Time labels */}
                <div
                  className="pointer-events-none"
                  style={{ position: "relative", height: 0, top: -(NUM_SLOTS * 20) }}
                >
                  {Array.from({ length: NUM_SLOTS }, (_, slotIdx) => {
                    const label = slotToLabel(slotIdx);
                    if (!label) return null;
                    return (
                      <div
                        key={slotIdx}
                        className="absolute flex items-center justify-end"
                        style={{ top: slotIdx * 20, left: 0, width: 36, height: 20 }}
                      >
                        <span className="text-[10px] font-medium leading-none" style={{ color: "rgba(0,0,0,0.35)" }}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* Legend + clear */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/5">
              <div className="flex items-center gap-5 text-[12px] text-black/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CELL_FREE }} />
                  free
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm border border-black/[0.12]" style={{ backgroundColor: CELL_BUSY }} />
                  busy
                </div>
              </div>
              <button
                onClick={() => {
                  const empty = {} as GridState;
                  for (const day of DAYS) empty[day] = Array(NUM_SLOTS).fill(false);
                  setGrid(empty);
                  update({ free_slots: {} });
                }}
                className="text-[12px] text-black/25 hover:text-black/60 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>

        {/* ── RECURRING + BLOCKED — side by side on lg+ ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Recurring commitments */}
          <div>
            <SectionHead>recurring commitments</SectionHead>
            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">

              {/* Existing list */}
              {recurring_blocks.length > 0 && (
                <div className="divide-y divide-black/[0.05]">
                  {recurring_blocks.map((rb) => (
                    <div key={rb.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[14px] font-medium text-black truncate">{rb.label}</span>
                        <span className="text-[12px] text-black/40">
                          {rb.days.map((d) => DAY_ABBR[d] ?? d.slice(0, 2)).join(", ")}
                          {" · "}
                          {rb.start_time}–{rb.end_time}
                        </span>
                      </div>
                      <button
                        onClick={() => update({ recurring_blocks: recurring_blocks.filter((b) => b.id !== rb.id) })}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-3 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add form */}
              <div className={`flex flex-col gap-3 p-5 ${recurring_blocks.length > 0 ? "border-t border-black/[0.05]" : ""}`}>
                {recurring_blocks.length > 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/30">Add new</p>
                )}
                {recurring_blocks.length === 0 && (
                  <p className="text-[13px] text-black/40 leading-snug -mb-1">
                    times you're regularly unavailable — work, class, gym. the AI won't schedule here.
                  </p>
                )}

                <input
                  className={inputCls}
                  placeholder="Label (e.g. Work, School, Gym)"
                  value={rbForm.label}
                  onChange={(e) => setRbForm((prev) => ({ ...prev, label: e.target.value }))}
                />

                <div className="flex gap-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleRbDay(day)}
                      className={`flex-1 py-2 text-[11px] font-semibold rounded-lg border transition-all ${
                        rbForm.days.includes(day)
                          ? "bg-black border-black text-white"
                          : "bg-black/5 border-black/8 text-black/30 hover:border-black/20 hover:text-black/60"
                      }`}
                    >
                      {DAY_ABBR[day]}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <TimeSelect value={rbForm.start_time} onChange={(v) => setRbForm((prev) => ({ ...prev, start_time: v }))} />
                  <span className="text-black/20 text-xs">–</span>
                  <TimeSelect value={rbForm.end_time} onChange={(v) => setRbForm((prev) => ({ ...prev, end_time: v }))} />
                </div>

                <button
                  className="w-full py-2.5 bg-black hover:bg-black/85 rounded-full text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  onClick={addRecurringBlock}
                  disabled={!rbForm.label.trim() || rbForm.days.length === 0}
                >
                  add commitment
                </button>
              </div>
            </div>
          </div>

          {/* Blocked dates */}
          <div>
            <SectionHead>blocked dates</SectionHead>
            <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">

              {/* Existing list */}
              {specific_blocks.length > 0 && (
                <div className="divide-y divide-black/[0.05]">
                  {specific_blocks.map((sb) => (
                    <div key={sb.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] font-medium text-black">
                          {sb.label && sb.label !== "Blocked" ? sb.label : sb.date}
                        </span>
                        <span className="text-[12px] text-black/40">
                          {sb.label && sb.label !== "Blocked" ? sb.date + " · " : ""}
                          {sb.all_day ? "All day" : `${sb.start_time}–${sb.end_time}`}
                        </span>
                      </div>
                      <button
                        onClick={() => update({ specific_blocks: specific_blocks.filter((b) => b.id !== sb.id) })}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-3 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add form */}
              <div className={`flex flex-col gap-3 p-5 ${specific_blocks.length > 0 ? "border-t border-black/[0.05]" : ""}`}>
                {specific_blocks.length > 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/30">Add new</p>
                )}
                {specific_blocks.length === 0 && (
                  <p className="text-[13px] text-black/40 leading-snug -mb-1">
                    specific dates or windows you're not available.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-black/40">date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={sbForm.date}
                      onChange={(e) => setSbForm((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-black/40">label (optional)</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. Holiday"
                      value={sbForm.label}
                      onChange={(e) => setSbForm((prev) => ({ ...prev, label: e.target.value }))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sbForm.all_day}
                    onClick={() => setSbForm((prev) => ({ ...prev, all_day: !prev.all_day }))}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-black/20 ${
                      sbForm.all_day ? "bg-black" : "bg-black/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        sbForm.all_day ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-[14px] text-black/60">all day</span>
                </label>

                {!sbForm.all_day && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <TimeSelect value={sbForm.start_time} onChange={(v) => setSbForm((prev) => ({ ...prev, start_time: v }))} />
                    <span className="text-black/20 text-xs">–</span>
                    <TimeSelect value={sbForm.end_time} onChange={(v) => setSbForm((prev) => ({ ...prev, end_time: v }))} />
                  </div>
                )}

                <button
                  className="w-full py-2.5 bg-black hover:bg-black/85 rounded-full text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  onClick={addSpecificBlock}
                  disabled={!sbForm.date}
                >
                  add date
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
