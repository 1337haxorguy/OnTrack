import Foundation
import Combine

let API_BASE = "https://ontrack-sq87.onrender.com"

let ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

func defaultSchedule() -> Schedule {
    Schedule(
        timezone: TimeZone.current.identifier,
        free_slots: Dictionary(uniqueKeysWithValues: ALL_DAYS.map { ($0, [TimeSlot]()) }),
        recurring_blocks: [],
        specific_blocks: []
    )
}

@MainActor
class AppState: ObservableObject {
    static let shared = AppState()

    @Published var goals: [Goal] = []
    @Published var schedule: Schedule = defaultSchedule()
    @Published var plan: [DayPlan]? = nil
    @Published var dataLoaded = false
    @Published var showingOnboarding = false
    @Published var readyForMainApp = false

    // Toast
    @Published var toast: ToastMessage? = nil
    private var toastTask: Task<Void, Never>? = nil

    private var syncTask: Task<Void, Never>? = nil

    // MARK: - Toast

    func showToast(_ message: String, actionLabel: String? = nil, actionRoute: AppRoute? = nil) {
        toastTask?.cancel()
        toast = ToastMessage(message: message, actionLabel: actionLabel, actionRoute: actionRoute)
        toastTask = Task {
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            if !Task.isCancelled { toast = nil }
        }
    }

    func dismissToast() {
        toastTask?.cancel()
        toast = nil
    }

    // MARK: - Load from backend

    func loadUserData(token: String) async {
        guard let url = URL(string: "\(API_BASE)/api/user-data") else { return }
        var req = URLRequest(url: url, timeoutInterval: 60)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let decoded = try JSONDecoder().decode(UserData.self, from: data)
            if let g = decoded.goals, !g.isEmpty { goals = g }
            if let s = decoded.schedule { schedule = s }
            if let p = decoded.plan, !p.isEmpty { plan = p }
        } catch {
            print("loadUserData error:", error)
        }
        dataLoaded = true
    }

    // MARK: - Save to backend (debounced)

    func queueSync(token: String) {
        syncTask?.cancel()
        syncTask = Task {
            try? await Task.sleep(nanoseconds: 600_000_000) // 600ms debounce
            if !Task.isCancelled { await flushToBackend(token: token) }
        }
    }

    private func flushToBackend(token: String) async {
        guard let url = URL(string: "\(API_BASE)/api/user-data") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let body = UserData(goals: goals, schedule: schedule, plan: plan)
        req.httpBody = try? JSONEncoder().encode(body)
        _ = try? await URLSession.shared.data(for: req)
    }
}

// MARK: - Supporting types

struct ToastMessage: Equatable {
    var message: String
    var actionLabel: String?
    var actionRoute: AppRoute?
}

enum AppRoute: Equatable {
    case today, calendar, goals, recap
}
