import SwiftUI

@main
struct OnTrackIOSApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authManager)
                .environmentObject(appState)
                .onAppear { }
        }
    }
}

#if DEBUG
@MainActor
private func loadMockData(into appState: AppState) {
    let today = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }()
    let cal = Calendar.current
    func date(adding days: Int) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: cal.date(byAdding: .day, value: days, to: Date())!)
    }

    appState.goals = [
        Goal(
            id: "mock-goal-1",
            title: "Get fit and lose weight",
            skill_level: .beginner,
            timeframe: Timeframe(start_date: today, end_date: date(adding: 30)),
            restrictions: ["bad knees"],
            requests: ["include warmup"],
            additional_context: "I go to the gym 3x a week already",
            followup_questions: [],
            hours_per_week: 4,
            has_daily_limit: false,
            daily_limit_minutes: 60,
            selected_days: ["monday", "wednesday", "friday"]
        )
    ]

    appState.plan = [
        DayPlan(
            date: today,
            objective: "Start the week strong with an upper body session",
            time_blocks: [
                TimeBlock(
                    id: "tb-1", goal_id: "mock-goal-1",
                    label: "Morning Warmup",
                    start_time: "08:00", end_time: "08:15",
                    tasks: [
                        PlanTask(title: "Light cardio warmup", description: "5 min jog on treadmill, arm circles, leg swings.", estimated_minutes: 10, completed: true),
                        PlanTask(title: "Dynamic stretching", description: "Hip flexors, hamstrings, shoulder rolls.", estimated_minutes: 5, completed: false)
                    ]
                ),
                TimeBlock(
                    id: "tb-2", goal_id: "mock-goal-1",
                    label: "Upper Body Strength",
                    start_time: "08:20", end_time: "09:00",
                    tasks: [
                        PlanTask(title: "Push-ups — 3×12", description: "Keep core tight, full range of motion.", estimated_minutes: 8, completed: false),
                        PlanTask(title: "Dumbbell rows — 3×10 each side", description: "Use a bench for support. Focus on squeezing the back.", estimated_minutes: 10, completed: false),
                        PlanTask(title: "Overhead press — 3×10", description: "Seated or standing, keep lower back neutral.", estimated_minutes: 10, completed: false),
                        PlanTask(title: "Tricep dips — 3×15", description: "Use a bench or parallel bars.", estimated_minutes: 8, completed: false)
                    ]
                )
            ]
        ),
        DayPlan(
            date: date(adding: 1),
            objective: "Active recovery — keep moving without overloading",
            time_blocks: [
                TimeBlock(
                    id: "tb-3", goal_id: "mock-goal-1",
                    label: "Evening Walk",
                    start_time: "18:00", end_time: "18:40",
                    tasks: [
                        PlanTask(title: "40 min brisk walk", description: "Aim for 100+ steps per minute. No phone.", estimated_minutes: 40, completed: false)
                    ]
                )
            ]
        ),
        DayPlan(
            date: date(adding: 2),
            objective: "Lower body focus — build leg strength and stability",
            time_blocks: [
                TimeBlock(
                    id: "tb-4", goal_id: "mock-goal-1",
                    label: "Lower Body Circuit",
                    start_time: "07:30", end_time: "08:20",
                    tasks: [
                        PlanTask(title: "Goblet squats — 4×12", description: "Hold dumbbell at chest. Drive through heels.", estimated_minutes: 10, completed: false),
                        PlanTask(title: "Romanian deadlifts — 3×10", description: "Light weight, hinge at hips, feel the hamstrings.", estimated_minutes: 10, completed: false),
                        PlanTask(title: "Walking lunges — 3×20 steps", description: "Keep torso upright, step wide.", estimated_minutes: 10, completed: false),
                        PlanTask(title: "Calf raises — 3×20", description: "Single leg or both. Slow controlled reps.", estimated_minutes: 7, completed: false)
                    ]
                )
            ]
        )
    ]

    appState.dataLoaded = true
}
#else
private func loadMockData(into appState: AppState) {}
#endif
