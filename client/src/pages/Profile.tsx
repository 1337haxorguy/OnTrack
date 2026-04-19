import { useState, useEffect, useRef } from "react";
import { useApp, DAYS } from "../context/AppContext";
import type { Day, Schedule } from "../context/AppContext";

// ── Grid constants ──────────────────────────────────────────
const GRID_START = 6 * 60;   // 6:00 AM in minutes from midnight
const GRID_END   = 23 * 60;  // 11:00 PM (last slot starts 10:30 PM)
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
        if (sStart >= fStart && sEnd <= fEnd) {
          grid[day][i] = true;
          break;
        }
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

// ── Time select for blocking forms ──────────────────────────
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
  "px-3 py-2.5 border border-black/10 rounded-xl bg-white text-black text-sm w-full " +
  "focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/25 " +
  "transition-colors placeholder:text-black/25";

const cardCls  = "rounded-2xl border border-black/8 bg-white shadow-sm p-5 flex flex-col gap-4";
const fieldLabel = "text-xs font-medium text-black/40";

const CELL_FREE    = "#0D9488";  // teal-600 — free/selected
const CELL_BUSY    = "#F0F0EE";  // warm off-white — busy/unselected
const CELL_PREVIEW = "#5EEAD4";  // teal-300 — preview during drag

const DAY_ABBR: Record<string, string> = {
  monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
  friday: "Fr", saturday: "Sa", sunday: "Su",
};

export default function Profile() {
  const { schedule, setSchedule, dataLoaded } = useApp();
  const { timezone, free_slots, recurring_blocks, specific_blocks } = schedule;

  useEffect(() => { document.title = "Schedule — OnTrack"; }, []);

  // ── Grid state ──────────────────────────────────────────
  const [grid, setGridState] = useState<GridState>(() => freeSlotsToGrid(free_slots));
  const gridRef = useRef<GridState>(grid);

  const setGrid = (newGrid: GridState) => {
    gridRef.current = newGrid;
    setGridState(newGrid);
  };

  const update = (patch: Partial<typeof schedule>) =>
    setSchedule((prev) => ({ ...prev, ...patch }));

  // Re-derive grid only once when server data finishes loading.
  // Never re-derive from free_slots changes after that — those are triggered
  // by the user's own drags and would overwrite the grid with a round-tripped value.
  const rehydrated = useRef(false);
  useEffect(() => {
    if (dataLoaded && !rehydrated.current) {
      rehydrated.current = true;
      const newGrid = freeSlotsToGrid(free_slots);
      gridRef.current = newGrid;
      setGridState(newGrid);
    }
  }, [dataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rectangle drag — DOM-first, React commits only on release ──
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const paintValue   = useRef(false);
  const dragStart    = useRef<{ dayIdx: number; slot: number } | null>(null);
  const dragEnd      = useRef<{ dayIdx: number; slot: number } | null>(null);
  const baseGrid     = useRef<GridState>(grid);

  
  // Paint cells directly in the DOM — zero React re-renders during drag
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
    // Find which cell is under the pointer by data attributes
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const di = el?.getAttribute("data-di");
    const si = el?.getAttribute("data-si");
    if (di === null || di === undefined || si === null || si === undefined) return;
    const endDi = parseInt(di);
    const endSi = parseInt(si);
    dragEnd.current = { dayIdx: endDi, slot: endSi };
    const { d0, d1, s0, s1 } = getRectFrom(endDi, endSi);
    // Paint with preview color for the active selection rectangle when painting
    const container = gridContainerRef.current;
    if (!container) return;
    const val = paintValue.current;
    container.querySelectorAll<HTMLElement>("[data-di]").forEach((cell) => {
      const cdi = parseInt(cell.getAttribute("data-di")!);
      const csi = parseInt(cell.getAttribute("data-si")!);
      const inRect = cdi >= d0 && cdi <= d1 && csi >= s0 && csi <= s1;
      if (inRect) {
        cell.style.backgroundColor = val ? CELL_PREVIEW : "#FECACA"; // teal preview or red-ish erase preview
      } else {
        cell.style.backgroundColor = baseGrid.current[DAYS[cdi]][csi] ? CELL_FREE : CELL_BUSY;
      }
    });
  };

  useEffect(() => {
    const stop = () => {
      if (!isDragging.current || !dragStart.current) {
        isDragging.current = false;
        return;
      }
      const end  = dragEnd.current ?? dragStart.current;
      const { d0, d1, s0, s1 } = getRectFrom(end.dayIdx, end.slot);
      const val  = paintValue.current;
      const base = baseGrid.current;

      // Build the committed grid first
      const newGrid = {} as GridState;
      for (const day of DAYS) newGrid[day] = [...base[day]];
      for (let di = d0; di <= d1; di++)
        for (let si = s0; si <= s1; si++)
          newGrid[DAYS[di]][si] = val;

      // Paint correct final colors explicitly — do NOT clear to "".
      // If we clear to "" React's style reconciler sees "no change" for cells
      // whose value didn't change (old fiber == new fiber) and skips the write,
      // leaving those cells colorless. Setting the actual final color here means
      // the DOM is correct before React commits, and reconciliation stays consistent.
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

  // ── Recurring blocks form ──────────────────────────────
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

  // ── Specific blocks form ───────────────────────────────
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

  // Compute a summary of selected hours per day for the subtitle
  const daySummary = (day: Day): string => {
    const g = gridRef.current[day];
    const count = g.filter(Boolean).length;
    if (count === 0) return "";
    return `${count / 2}h`;
  };

  return (
    <div className="max-w-2xl pb-20">
      <h1 className="text-2xl font-bold text-black mb-8">Schedule</h1>

      <div className="flex flex-col gap-4">

        {/* ── TIMEZONE ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-black mb-1">Timezone</h2>
            <p className="text-xs text-black/40">Used to schedule tasks at the right local times.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabel}>Timezone</label>
            <input
              className={`${inputCls} max-w-xs`}
              placeholder="e.g. Europe/London, America/New_York"
              value={timezone}
              onChange={(e) => update({ timezone: e.target.value })}
            />
          </div>
        </section>

        {/* ── FREE TIME GRID ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-black mb-1">When are you free?</h2>
            <p className="text-xs text-black/40">Click or drag to mark your available time slots.</p>
          </div>

          {/* Grid */}
          <div
            ref={gridContainerRef}
            className="select-none touch-none overflow-x-auto"
            onPointerMove={handleContainerPointerMove}
          >
            <div style={{ minWidth: 300 }}>

              {/* Day headers */}
              <div className="flex mb-2" style={{ paddingLeft: 40 }}>
                {DAYS.map(day => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                      {DAY_ABBR[day]}
                    </span>
                    <span className="text-[9px] font-medium tabular-nums h-3" style={{ color: "#0D9488", opacity: daySummary(day) ? 1 : 0 }}>
                      {daySummary(day)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid body — outer border wrapper */}
              <div
                style={{
                  marginLeft: 40,
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.10)",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {/* Time rows */}
                {Array.from({ length: NUM_SLOTS }, (_, slotIdx) => {
                  const label = slotToLabel(slotIdx);
                  const isHour = label !== "";
                  const isHalfHour = !isHour;
                  return (
                    <div key={slotIdx} className="flex relative" style={{ height: 20 }}>
                      {/* Day cells */}
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
                              borderTop: isHalfHour ? "1px solid rgba(0,0,0,0.04)" : "none",
                            }}
                            onPointerDown={handleCellPointerDown(di, slotIdx)}
                          />
                        );
                      })}
                      {/* Hour divider line — drawn over cells */}
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

              {/* Time labels — overlay aligned to the left of the grid.
                  position:relative + height:0 + top:-(NUM_SLOTS*20) places this
                  div's top edge at the top of the grid body, so label top values
                  map 1:1 to grid row positions. Each label is 20px tall (one row)
                  with flex centering so it aligns exactly with its slot. */}
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
                      style={{
                        top: slotIdx * 20,
                        left: 0,
                        width: 36,
                        height: 20,
                      }}
                    >
                      <span className="text-[10px] font-medium leading-none" style={{ color: "rgba(0,0,0,0.38)" }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Legend + clear */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4 text-xs text-black/40">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#0D9488" }} />
                <span>Free</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border border-black/10" style={{ backgroundColor: "#F0F0EE" }} />
                <span>Busy</span>
              </div>
            </div>
            <button
              onClick={() => {
                const empty = {} as GridState;
                for (const day of DAYS) empty[day] = Array(NUM_SLOTS).fill(false);
                setGrid(empty);
                update({ free_slots: {} });
              }}
              className="text-xs text-black/25 hover:text-black/60 transition-colors"
            >
              Clear all
            </button>
          </div>
        </section>

        {/* ── RECURRING COMMITMENTS ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-black mb-1">Recurring commitments</h2>
            <p className="text-xs text-black/40">Times you're regularly unavailable — work, class, gym. The AI won't schedule here.</p>
          </div>

          {/* Existing blocks */}
          {recurring_blocks.length > 0 && (
            <div className="flex flex-col divide-y divide-black/6 -mx-5 px-5">
              {recurring_blocks.map((rb) => (
                <div key={rb.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm text-black font-medium truncate">{rb.label}</span>
                    <span className="text-xs text-black/40">
                      {rb.days.map((d) => DAY_ABBR[d] ?? d.slice(0, 2)).join(", ")}
                      {" · "}
                      {rb.start_time}–{rb.end_time}
                    </span>
                  </div>
                  <button
                    onClick={() => update({ recurring_blocks: recurring_blocks.filter((b) => b.id !== rb.id) })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-3"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <div className={`flex flex-col gap-3 ${recurring_blocks.length > 0 ? "pt-1 border-t border-black/6" : ""}`}>
            {recurring_blocks.length > 0 && (
              <p className="text-xs font-medium text-black/40">Add a commitment</p>
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
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                    rbForm.days.includes(day)
                      ? "bg-black border-black text-white"
                      : "bg-black/5 border-black/8 text-black/30 hover:border-black/20 hover:text-black/60"
                  }`}
                >
                  {DAY_ABBR[day]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <TimeSelect value={rbForm.start_time} onChange={(v) => setRbForm((prev) => ({ ...prev, start_time: v }))} />
              <span className="text-black/20 text-xs shrink-0">–</span>
              <TimeSelect value={rbForm.end_time} onChange={(v) => setRbForm((prev) => ({ ...prev, end_time: v }))} />
              <button
                className="ml-auto px-4 py-2 bg-black hover:bg-black/80 rounded-full text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                onClick={addRecurringBlock}
                disabled={!rbForm.label.trim() || rbForm.days.length === 0}
              >
                Add
              </button>
            </div>
          </div>
        </section>

        {/* ── BLOCKED DATES ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-black mb-1">Blocked dates</h2>
            <p className="text-xs text-black/40">Specific dates or windows you're not available.</p>
          </div>

          {/* Existing blocks */}
          {specific_blocks.length > 0 && (
            <div className="flex flex-col divide-y divide-black/6 -mx-5 px-5">
              {specific_blocks.map((sb) => (
                <div key={sb.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-black font-medium">
                      {sb.label && sb.label !== "Blocked" ? sb.label : sb.date}
                    </span>
                    <span className="text-xs text-black/40">
                      {sb.label && sb.label !== "Blocked" ? sb.date + " · " : ""}
                      {sb.all_day ? "All day" : `${sb.start_time}–${sb.end_time}`}
                    </span>
                  </div>
                  <button
                    onClick={() => update({ specific_blocks: specific_blocks.filter((b) => b.id !== sb.id) })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-black/20 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-3"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <div className={`flex flex-col gap-3 ${specific_blocks.length > 0 ? "pt-1 border-t border-black/6" : ""}`}>
            {specific_blocks.length > 0 && (
              <p className="text-xs font-medium text-black/40">Add a date</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel}>Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={sbForm.date}
                  onChange={(e) => setSbForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel}>Label (optional)</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Holiday, Doctor"
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
              <span className="text-sm text-black/70">All day</span>
            </label>

            {!sbForm.all_day && (
              <div className="flex items-center gap-3">
                <TimeSelect value={sbForm.start_time} onChange={(v) => setSbForm((prev) => ({ ...prev, start_time: v }))} />
                <span className="text-black/20 text-xs shrink-0">–</span>
                <TimeSelect value={sbForm.end_time} onChange={(v) => setSbForm((prev) => ({ ...prev, end_time: v }))} />
              </div>
            )}

            <button
              className="w-full py-2.5 bg-black hover:bg-black/80 rounded-full text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={addSpecificBlock}
              disabled={!sbForm.date}
            >
              Add date
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
