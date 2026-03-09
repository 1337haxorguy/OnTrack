import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp, DAYS } from "../context/AppContext";
import type { Goal } from "../context/AppContext";

const emptyGoal = (): Omit<Goal, "id"> => ({
  title: "",
  skill_level: "beginner",
  timeframe: { start_date: "", end_date: "" },
  restrictions: [],
  requests: [],
  additional_context: "",
  followup_questions: [],
  hours_per_week: 4,
  has_daily_limit: false,
  daily_limit_minutes: 60,
  selected_days: [],
});

const inputCls = "p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full focus:outline-none focus:border-indigo-500";
const sectionHead = "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3";

export default function CreateGoal() {
  const { goals, setGoals } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [form, setForm] = useState<Omit<Goal, "id">>(emptyGoal());
  const [newRestriction, setNewRestriction] = useState("");
  const [newRequest, setNewRequest] = useState("");
  const [newFq, setNewFq] = useState({ question: "", user_response: "" });

  useEffect(() => {
    if (id) {
      const existing = goals.find((g) => g.id === id);
      if (existing) {
        const { id: _, ...rest } = existing;
        setForm(rest);
      }
    }
  }, [id, goals]);

  const patch = (update: Partial<Omit<Goal, "id">>) =>
    setForm((prev) => ({ ...prev, ...update }));

  const toggleDay = (day: string) =>
    patch({
      selected_days: form.selected_days.includes(day)
        ? form.selected_days.filter((d) => d !== day)
        : [...form.selected_days, day],
    });

  const addRestriction = () => {
    if (!newRestriction.trim()) return;
    patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
    setNewRestriction("");
  };

  const addRequest = () => {
    if (!newRequest.trim()) return;
    patch({ requests: [...form.requests, newRequest.trim()] });
    setNewRequest("");
  };

  const addFq = () => {
    if (!newFq.question.trim()) return;
    patch({ followup_questions: [...form.followup_questions, { ...newFq }] });
    setNewFq({ question: "", user_response: "" });
  };

  const save = () => {
    if (!form.title.trim()) return;
    if (isEditing && id) {
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...form, id } : g)));
    } else {
      setGoals((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
    }
    navigate("/");
  };

  const deleteGoal = () => {
    if (!id) return;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    navigate("/");
  };

  return (
    <div className="max-w-2xl pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/")}
          className="text-gray-500 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">{isEditing ? "Edit Goal" : "New Goal"}</h1>
      </div>

      <div className="flex flex-col gap-8">

        {/* ---- ABOUT ---- */}
        <section>
          <h2 className={sectionHead}>About this goal</h2>
          <div className="flex flex-col gap-3">
            <input
              className={inputCls}
              placeholder="Goal title (e.g. Learn fingerstyle guitar, Run a 5K)"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
            <select
              className={inputCls}
              value={form.skill_level}
              onChange={(e) => patch({ skill_level: e.target.value as Goal["skill_level"] })}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <div className="flex gap-3">
              <label className="flex-1 flex flex-col gap-1 text-xs text-gray-400">
                Start date
                <input
                  type="date"
                  className={inputCls}
                  value={form.timeframe.start_date}
                  onChange={(e) => patch({ timeframe: { ...form.timeframe, start_date: e.target.value } })}
                />
              </label>
              <label className="flex-1 flex flex-col gap-1 text-xs text-gray-400">
                End date
                <input
                  type="date"
                  className={inputCls}
                  value={form.timeframe.end_date}
                  onChange={(e) => patch({ timeframe: { ...form.timeframe, end_date: e.target.value } })}
                />
              </label>
            </div>
          </div>
        </section>

        {/* ---- SCHEDULING ---- */}
        <section>
          <h2 className={sectionHead}>Scheduling</h2>
          <div className="flex flex-col gap-5">

            {/* Hours per week */}
            <label className="flex flex-col gap-2 text-sm text-gray-400">
              How many hours per week can you commit?
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={20} step={1}
                  className="flex-1 accent-indigo-500"
                  value={form.hours_per_week}
                  onChange={(e) => patch({ hours_per_week: Number(e.target.value) })}
                />
                <span className="text-white font-medium w-20 text-right tabular-nums">
                  {form.hours_per_week} hr{form.hours_per_week !== 1 && "s"}
                </span>
              </div>
            </label>

            {/* Day selection */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Which days work best?</p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => (
                  <button
                    key={day} type="button"
                    onClick={() => toggleDay(day)}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                      form.selected_days.includes(day)
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                {form.selected_days.length === 0
                  ? "Any day (AI decides)"
                  : `${form.selected_days.length} day${form.selected_days.length !== 1 ? "s" : ""} selected`}
              </p>
            </div>

            {/* Daily limit */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox" className="accent-indigo-500"
                  checked={form.has_daily_limit}
                  onChange={(e) => patch({ has_daily_limit: e.target.checked })}
                />
                Set a daily time limit
              </label>
              {form.has_daily_limit && (
                <div className="mt-2 ml-5 flex items-center gap-2">
                  <input
                    type="number" min={15} max={480} step={15}
                    className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-24"
                    value={form.daily_limit_minutes}
                    onChange={(e) => patch({ daily_limit_minutes: Number(e.target.value) })}
                  />
                  <span className="text-sm text-gray-500">minutes max per day</span>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ---- CONTEXT ---- */}
        <section>
          <h2 className={sectionHead}>Additional context</h2>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            The more detail you give, the better the AI can tailor your plan. This is how you fix plans that feel too easy, too hard, or off-target.
          </p>

          <div className="flex flex-col gap-6">

            {/* Restrictions */}
            <div>
              <p className="text-sm text-gray-300 mb-1">Restrictions</p>
              <p className="text-xs text-gray-500 mb-2">Physical limits, noise constraints, equipment, injury history, etc.</p>
              {form.restrictions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.restrictions.map((r, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
                      {r}
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={() => patch({ restrictions: form.restrictions.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Occasional wrist soreness, no loud practice after 10pm"
                  value={newRestriction}
                  onChange={(e) => setNewRestriction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRestriction()}
                />
                <button
                  className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm hover:bg-gray-600"
                  onClick={addRestriction}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Requests */}
            <div>
              <p className="text-sm text-gray-300 mb-1">Requests</p>
              <p className="text-xs text-gray-500 mb-2">Things you want the AI to always include or focus on.</p>
              {form.requests.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.requests.map((r, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
                      {r}
                      <button
                        className="text-red-400 hover:text-red-300"
                        onClick={() => patch({ requests: form.requests.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Always include a warm-up, balance drills with song practice"
                  value={newRequest}
                  onChange={(e) => setNewRequest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRequest()}
                />
                <button
                  className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm hover:bg-gray-600"
                  onClick={addRequest}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Additional context */}
            <label className="flex flex-col gap-1 text-sm text-gray-300">
              Background & context
              <p className="text-xs text-gray-500 mb-1">Your current level, upcoming deadlines, goals within the goal, anything else relevant.</p>
              <textarea
                className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm min-h-[90px] resize-y focus:outline-none focus:border-indigo-500"
                placeholder="e.g. I know basic open chords and can play simple songs. I want to perform at an open mic in 2 months. I prefer sessions in the early evening on weekdays."
                value={form.additional_context}
                onChange={(e) => patch({ additional_context: e.target.value })}
              />
            </label>

            {/* Follow-up Q&A */}
            <div>
              <p className="text-sm text-gray-300 mb-1">Follow-up Q&A</p>
              <p className="text-xs text-gray-500 mb-3">
                Add specific question–answer pairs to give the AI targeted context it can't infer from the above.
              </p>

              {form.followup_questions.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {form.followup_questions.map((fq, i) => (
                    <div key={i} className="border border-gray-700 rounded-lg p-3 bg-gray-900/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">Q: {fq.question}</p>
                          <p className="text-sm text-gray-200">A: {fq.user_response}</p>
                        </div>
                        <button
                          className="text-red-400 text-xs hover:text-red-300 shrink-0"
                          onClick={() => patch({ followup_questions: form.followup_questions.filter((_, j) => j !== i) })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-dashed border-gray-700 rounded-lg p-3 flex flex-col gap-2">
                <input
                  className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Question (e.g. What songs do you want to learn first?)"
                  value={newFq.question}
                  onChange={(e) => setNewFq((prev) => ({ ...prev, question: e.target.value }))}
                />
                <input
                  className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Your answer"
                  value={newFq.user_response}
                  onChange={(e) => setNewFq((prev) => ({ ...prev, user_response: e.target.value }))}
                />
                <button
                  className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white hover:bg-gray-600 self-start disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={addFq}
                  disabled={!newFq.question.trim()}
                >
                  + Add Q&A
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ---- ACTIONS ---- */}
        <div className="flex gap-3 pt-2 border-t border-gray-800">
          <button
            className="flex-1 py-2.5 bg-indigo-600 rounded text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={save}
            disabled={!form.title.trim()}
          >
            {isEditing ? "Save changes" : "Create goal"}
          </button>
          {isEditing && (
            <button
              className="px-4 py-2.5 border border-red-800 rounded text-red-400 text-sm hover:bg-red-900/30 transition-colors"
              onClick={deleteGoal}
            >
              Delete
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
