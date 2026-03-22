import { useState } from "react";
import { useApp, DAYS } from "../context/AppContext";
import type { Day } from "../context/AppContext";

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
      className="px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors cursor-pointer"
    >
      {TIMES.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

const inputCls =
  "px-3 py-2.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm w-full " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "transition-colors placeholder:text-gray-600";


const cardCls = "rounded-xl border border-gray-800 bg-gray-900/40 p-5 flex flex-col gap-4";
const fieldLabel = "text-xs font-medium text-gray-400";

export default function Profile() {
  const { schedule, setSchedule } = useApp();
  const { timezone, free_slots, recurring_blocks, specific_blocks } = schedule;

  const [rbForm, setRbForm] = useState({
    label: "",
    days: [] as Day[],
    start_time: "09:00",
    end_time: "17:00",
  });
  const [sbForm, setSbForm] = useState({
    label: "",
    date: "",
    all_day: true,
    start_time: "09:00",
    end_time: "10:00",
  });

  const update = (patch: Partial<typeof schedule>) =>
    setSchedule((prev) => ({ ...prev, ...patch }));

  const addSlot = (day: string) =>
    update({ free_slots: { ...free_slots, [day]: [...(free_slots[day] || []), { start: "09:00", end: "17:00" }] } });

  const removeSlot = (day: string, i: number) =>
    update({ free_slots: { ...free_slots, [day]: free_slots[day].filter((_, idx) => idx !== i) } });

  const updateSlot = (day: string, i: number, field: "start" | "end", value: string) =>
    update({
      free_slots: {
        ...free_slots,
        [day]: free_slots[day].map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
      },
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

  const DAY_ABBR: Record<string, string> = {
    monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
    friday: "Fr", saturday: "Sa", sunday: "Su",
  };

  return (
    <div className="max-w-2xl pb-20">
      <h1 className="text-xl font-bold mb-8">Schedule</h1>

      <div className="flex flex-col gap-4">

        {/* ── TIMEZONE ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Timezone</h2>
            <p className="text-xs text-gray-500">Used to schedule tasks at the right local times.</p>
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

        {/* ── FREE TIME ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">When are you free?</h2>
            <p className="text-xs text-gray-500">Toggle the days you're available and set your hours.</p>
          </div>

          <div className="flex flex-col divide-y divide-gray-800">
            {DAYS.map((day) => {
              const slots = free_slots[day] || [];
              const enabled = slots.length > 0;
              return (
                <div key={day} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                  {/* Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() =>
                      enabled
                        ? update({ free_slots: { ...free_slots, [day]: [] } })
                        : addSlot(day)
                    }
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                      enabled ? "bg-indigo-600" : "bg-gray-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
                  </button>

                  {/* Day name */}
                  <span className={`w-24 shrink-0 text-sm font-medium capitalize ${enabled ? "text-gray-200" : "text-gray-600"}`}>
                    {day}
                  </span>

                  {/* Slots or unavailable */}
                  {enabled ? (
                    <div className="flex flex-col gap-2 flex-1">
                      {slots.map((slot, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <TimeSelect value={slot.start} onChange={(v) => updateSlot(day, i, "start", v)} />
                          <span className="text-gray-600 text-xs shrink-0">–</span>
                          <TimeSelect value={slot.end} onChange={(v) => updateSlot(day, i, "end", v)} />
                          {slots.length > 1 && (
                            <button
                              onClick={() => removeSlot(day, i)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors shrink-0"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addSlot(day)}
                        className="self-start text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        + Add time
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-600 mt-0.5">Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RECURRING COMMITMENTS ── */}
        <section className={cardCls}>
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Recurring commitments</h2>
            <p className="text-xs text-gray-500">Times you're regularly unavailable — work, class, gym, etc. The AI won't schedule here.</p>
          </div>

          {/* Existing blocks */}
          {recurring_blocks.length > 0 && (
            <div className="flex flex-col divide-y divide-gray-800 -mx-5 px-5">
              {recurring_blocks.map((rb) => (
                <div key={rb.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm text-white font-medium truncate">{rb.label}</span>
                    <span className="text-xs text-gray-500">
                      {rb.days.map((d) => DAY_ABBR[d] ?? d.slice(0, 2)).join(", ")}
                      {" · "}
                      {rb.start_time}–{rb.end_time}
                    </span>
                  </div>
                  <button
                    onClick={() => update({ recurring_blocks: recurring_blocks.filter((b) => b.id !== rb.id) })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors shrink-0 ml-3"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <div className="flex flex-col gap-3 pt-1 border-t border-gray-800">
            <p className="text-xs font-medium text-gray-400">Add a commitment</p>

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
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {DAY_ABBR[day]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <TimeSelect value={rbForm.start_time} onChange={(v) => setRbForm((prev) => ({ ...prev, start_time: v }))} />
              <span className="text-gray-600 text-xs shrink-0">–</span>
              <TimeSelect value={rbForm.end_time} onChange={(v) => setRbForm((prev) => ({ ...prev, end_time: v }))} />
              <button
                className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <h2 className="text-sm font-semibold text-white mb-1">Blocked dates</h2>
            <p className="text-xs text-gray-500">Specific dates or time windows you're not available.</p>
          </div>

          {/* Existing blocks */}
          {specific_blocks.length > 0 && (
            <div className="flex flex-col divide-y divide-gray-800 -mx-5 px-5">
              {specific_blocks.map((sb) => (
                <div key={sb.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-white font-medium">
                      {sb.label && sb.label !== "Blocked" ? sb.label : sb.date}
                    </span>
                    <span className="text-xs text-gray-500">
                      {sb.label && sb.label !== "Blocked" ? sb.date + " · " : ""}
                      {sb.all_day ? "All day" : `${sb.start_time}–${sb.end_time}`}
                    </span>
                  </div>
                  <button
                    onClick={() => update({ specific_blocks: specific_blocks.filter((b) => b.id !== sb.id) })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-gray-800 transition-colors shrink-0 ml-3"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <div className="flex flex-col gap-3 pt-1 border-t border-gray-800">
            <p className="text-xs font-medium text-gray-400">Add a date</p>

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
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  sbForm.all_day ? "bg-indigo-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    sbForm.all_day ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-300">All day</span>
            </label>

            {!sbForm.all_day && (
              <div className="flex items-center gap-3">
                <TimeSelect value={sbForm.start_time} onChange={(v) => setSbForm((prev) => ({ ...prev, start_time: v }))} />
                <span className="text-gray-600 text-xs shrink-0">–</span>
                <TimeSelect value={sbForm.end_time} onChange={(v) => setSbForm((prev) => ({ ...prev, end_time: v }))} />
              </div>
            )}

            <button
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
