import { useState } from "react";
import { useApp, DAYS } from "../context/AppContext";
import type { Day } from "../context/AppContext";

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

  // Free slots
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

  // Recurring blocks
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

  const sectionHead = "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1";

  return (
    <div className="max-w-2xl pb-16">
      <h1 className="text-xl font-bold mb-8">Schedule</h1>

      {/* Timezone */}
      <section className="mb-8">
        <h2 className={sectionHead}>Timezone</h2>
        <p className="text-xs text-gray-500 mb-3">Used to schedule tasks at the right local times.</p>
        <input
          className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm max-w-xs w-full focus:outline-none focus:border-indigo-500"
          value={timezone}
          onChange={(e) => update({ timezone: e.target.value })}
        />
      </section>

      {/* Free time per day */}
      <section className="mb-8">
        <h2 className={sectionHead}>When are you free?</h2>
        <p className="text-xs text-gray-500 mb-4">Add time windows you're available to work on your goals each day.</p>
        <div className="flex flex-col gap-2">
          {DAYS.map((day) => (
            <div key={day} className="flex items-start gap-3 min-h-[36px]">
              <span className="w-24 capitalize text-sm text-gray-400 pt-2 shrink-0">{day}</span>
              <div className="flex flex-wrap items-center gap-2">
                {(free_slots[day] || []).map((slot, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input
                      type="time"
                      className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                      value={slot.start}
                      onChange={(e) => updateSlot(day, i, "start", e.target.value)}
                    />
                    <span className="text-xs text-gray-500">–</span>
                    <input
                      type="time"
                      className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                      value={slot.end}
                      onChange={(e) => updateSlot(day, i, "end", e.target.value)}
                    />
                    <button
                      className="text-red-400 text-xs px-1.5 py-1 hover:bg-gray-800 rounded"
                      onClick={() => removeSlot(day, i)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  className="text-xs px-2 py-1 border border-dashed border-gray-600 rounded text-gray-500 hover:text-white hover:border-gray-400 transition-colors"
                  onClick={() => addSlot(day)}
                >
                  + slot
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recurring commitments */}
      <section className="mb-8">
        <h2 className={sectionHead}>Recurring commitments</h2>
        <p className="text-xs text-gray-500 mb-4">Times you're regularly NOT free — work, class, gym, etc. The AI won't schedule tasks here.</p>

        {recurring_blocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {recurring_blocks.map((rb) => (
              <span
                key={rb.id}
                className="flex items-center gap-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5"
              >
                <span className="text-gray-200 font-medium">{rb.label}</span>
                <span className="text-gray-500">
                  {rb.days.map((d) => d.slice(0, 3)).join(", ")} · {rb.start_time}–{rb.end_time}
                </span>
                <button
                  className="text-red-400 ml-0.5 hover:text-red-300"
                  onClick={() => update({ recurring_blocks: recurring_blocks.filter((b) => b.id !== rb.id) })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="border border-gray-700 rounded-lg p-3 flex flex-col gap-3">
          <input
            className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Label (e.g. Work, School, Gym)"
            value={rbForm.label}
            onChange={(e) => setRbForm((prev) => ({ ...prev, label: e.target.value }))}
          />
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day) => (
              <button
                key={day} type="button"
                onClick={() => toggleRbDay(day)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  rbForm.days.includes(day)
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="time"
              className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
              value={rbForm.start_time}
              onChange={(e) => setRbForm((prev) => ({ ...prev, start_time: e.target.value }))}
            />
            <span className="text-xs text-gray-500">–</span>
            <input
              type="time"
              className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
              value={rbForm.end_time}
              onChange={(e) => setRbForm((prev) => ({ ...prev, end_time: e.target.value }))}
            />
            <button
              className="ml-auto px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={addRecurringBlock}
              disabled={!rbForm.label.trim() || rbForm.days.length === 0}
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Specific blocked dates */}
      <section>
        <h2 className={sectionHead}>Blocked dates</h2>
        <p className="text-xs text-gray-500 mb-4">Specific dates or time windows you're not available.</p>

        {specific_blocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {specific_blocks.map((sb) => (
              <span
                key={sb.id}
                className="flex items-center gap-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5"
              >
                <span className="text-gray-200 font-medium">{sb.date}</span>
                <span className="text-gray-500">{sb.all_day ? "All day" : `${sb.start_time}–${sb.end_time}`}</span>
                {sb.label && sb.label !== "Blocked" && (
                  <span className="text-gray-600">· {sb.label}</span>
                )}
                <button
                  className="text-red-400 ml-0.5 hover:text-red-300"
                  onClick={() => update({ specific_blocks: specific_blocks.filter((b) => b.id !== sb.id) })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="border border-gray-700 rounded-lg p-3 flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <input
              type="date"
              className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm flex-1 min-w-[160px] focus:outline-none focus:border-indigo-500"
              value={sbForm.date}
              onChange={(e) => setSbForm((prev) => ({ ...prev, date: e.target.value }))}
            />
            <input
              className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm flex-1 min-w-[160px] focus:outline-none focus:border-indigo-500"
              placeholder="Label (optional, e.g. Holiday)"
              value={sbForm.label}
              onChange={(e) => setSbForm((prev) => ({ ...prev, label: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox" className="accent-indigo-500"
                checked={sbForm.all_day}
                onChange={(e) => setSbForm((prev) => ({ ...prev, all_day: e.target.checked }))}
              />
              All day
            </label>
            {!sbForm.all_day && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                  value={sbForm.start_time}
                  onChange={(e) => setSbForm((prev) => ({ ...prev, start_time: e.target.value }))}
                />
                <span className="text-xs text-gray-500">–</span>
                <input
                  type="time"
                  className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                  value={sbForm.end_time}
                  onChange={(e) => setSbForm((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            )}
            <button
              className="ml-auto px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={addSpecificBlock}
              disabled={!sbForm.date}
            >
              Add
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
