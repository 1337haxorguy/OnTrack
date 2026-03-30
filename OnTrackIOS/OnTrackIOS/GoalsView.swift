import SwiftUI

struct GoalsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var generating = false
    @State private var generateError = ""
    @State private var regenGoalId: String? = nil
    @State private var regenError: String? = nil
    @State private var showCreateGoal = false

    private var today: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    private var isPlanStale: Bool {
        guard let plan = appState.plan, !plan.isEmpty else { return false }
        return plan.allSatisfy { $0.date < today }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if appState.goals.isEmpty {
                    emptyState
                } else {
                    goalsList
                }
            }
            .navigationTitle("Goals")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showCreateGoal = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreateGoal) {
                NavigationStack {
                    GoalCreationView()
                }
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.indigo.opacity(0.2))
                    .frame(width: 64, height: 64)
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 28))
                    .foregroundColor(.indigo)
            }
            Text("No goals yet")
                .font(.title2.bold())
                .foregroundColor(.white)
            Text("Create your first goal and OnTrack will build a personalised weekly plan.")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button { showCreateGoal = true } label: {
                Text("Create your first goal")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
        }
    }

    // MARK: - Goals list

    private var goalsList: some View {
        ScrollView {
            VStack(spacing: 12) {

                // Stale plan banner
                if isPlanStale {
                    NavigationLink(destination: RecapView()) {
                        HStack {
                            Image(systemName: "doc.plaintext")
                                .foregroundColor(.orange)
                            Text("Your plan is complete — review and generate a new one")
                                .font(.caption.weight(.medium))
                                .foregroundColor(.orange)
                            Spacer()
                            Text("Recap →")
                                .font(.caption2)
                                .foregroundColor(.orange.opacity(0.7))
                        }
                        .padding(12)
                        .background(Color.orange.opacity(0.1))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.orange.opacity(0.3), lineWidth: 1))
                        .cornerRadius(12)
                    }
                }

                // Error
                if !generateError.isEmpty {
                    Text(generateError)
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(10)
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                }

                // Generate button
                Button {
                    Task { await generatePlan() }
                } label: {
                    HStack {
                        if generating {
                            ProgressView().tint(.white).scaleEffect(0.8)
                        }
                        Text(generating ? "Generating…" : "Generate Plan")
                            .font(.subheadline.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(generating || regenGoalId != nil)

                // Goal cards
                ForEach(appState.goals) { goal in
                    GoalCard(
                        goal: goal,
                        isRegening: regenGoalId == goal.id,
                        hasError: regenError == goal.id,
                        hasPlan: appState.plan != nil && !(appState.plan?.isEmpty ?? true),
                        onRegen: { Task { await regenerateGoal(goalId: goal.id) } }
                    )
                }
            }
            .padding(16)
        }
    }

    // MARK: - Actions

    private func generatePlan() async {
        generating = true
        generateError = ""
        do {
            let token = await auth.getToken()
            let newDays = try await APIService.generatePlan(
                goals: appState.goals,
                schedule: appState.schedule,
                token: token
            )
            appState.plan = attributeBlocks(plan: newDays, goals: appState.goals)
            if let token { appState.queueSync(token: token) }
            appState.showToast("Your plan is ready!", actionLabel: "View calendar →", actionRoute: .calendar)
        } catch {
            generateError = "Failed to generate plan. Try again."
        }
        generating = false
    }

    private func regenerateGoal(goalId: String) async {
        guard let goal = appState.goals.first(where: { $0.id == goalId }) else { return }
        regenGoalId = goalId
        regenError = nil
        do {
            let token = await auth.getToken()
            let newDays = try await APIService.regenerateGoal(goal: goal, schedule: appState.schedule, token: token)
            appState.plan = mergeGoalPlan(existing: appState.plan ?? [], newDays: newDays, goalId: goalId)
            if let token { appState.queueSync(token: token) }
            appState.showToast("\"\(goal.title)\" blocks updated!", actionLabel: "View calendar →", actionRoute: .calendar)
        } catch {
            regenError = goalId
        }
        regenGoalId = nil
    }
}

// MARK: - Goal card

struct GoalCard: View {
    let goal: Goal
    let isRegening: Bool
    let hasError: Bool
    let hasPlan: Bool
    let onRegen: () -> Void

    @State private var showEdit = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(goal.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)

                    // Tags
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            tag(goal.skill_level.rawValue.capitalized)
                            if !goal.timeframe.start_date.isEmpty && !goal.timeframe.end_date.isEmpty {
                                tag("\(goal.timeframe.start_date) → \(goal.timeframe.end_date)", color: .gray)
                            }
                            tag("\(formatHours(goal.hours_per_week)) hrs/week", color: .gray)
                            if !goal.selected_days.isEmpty {
                                tag(goal.selected_days.map { String($0.prefix(3)).capitalized }.joined(separator: ", "), color: .gray)
                            }
                            if !goal.restrictions.isEmpty {
                                tag("\(goal.restrictions.count) restriction\(goal.restrictions.count != 1 ? "s" : "")", color: .orange)
                            }
                        }
                    }
                }

                Spacer()

                VStack(spacing: 8) {
                    if hasPlan {
                        Button(action: onRegen) {
                            HStack(spacing: 4) {
                                if isRegening {
                                    ProgressView().tint(.indigo).scaleEffect(0.7)
                                } else {
                                    Image(systemName: "arrow.clockwise")
                                        .font(.caption)
                                }
                                Text(isRegening ? "…" : "Regen")
                                    .font(.caption)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.white.opacity(0.06))
                            .foregroundColor(isRegening ? .indigo : .gray)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1))
                        }
                        .disabled(isRegening)
                    }

                    Button { showEdit = true } label: {
                        Text("Edit →")
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.white.opacity(0.06))
                            .foregroundColor(.gray)
                            .cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 1))
                    }
                }
            }

            if hasError {
                Text("Failed to regenerate. Try again.")
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding(14)
        .background(isRegening ? Color.indigo.opacity(0.08) : Color.white.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(isRegening ? Color.indigo.opacity(0.3) : Color.white.opacity(0.08), lineWidth: 1))
        .cornerRadius(14)
        .sheet(isPresented: $showEdit) {
            CreateGoalView(editingGoal: goal)
        }
    }

    private func tag(_ text: String, color: Color = .indigo) -> some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .foregroundColor(color == .gray ? Color(white: 0.6) : color)
            .cornerRadius(20)
            .overlay(Capsule().stroke(color.opacity(0.2), lineWidth: 1))
    }

    private func formatHours(_ h: Double) -> String {
        h == h.rounded() ? String(Int(h)) : String(format: "%.1f", h)
    }
}

// MARK: - Helpers

func attributeBlocks(plan: [DayPlan], goals: [Goal]) -> [DayPlan] {
    if goals.isEmpty { return plan }
    if goals.count == 1 {
        let gid = goals[0].id
        return plan.map { day in
            var d = day
            d.time_blocks = day.time_blocks.map { var b = $0; b.goal_id = gid; return b }
            return d
        }
    }
    return plan.map { day in
        var d = day
        d.time_blocks = day.time_blocks.map { block in
            if block.goal_id != nil { return block }
            let labelLower = block.label.lowercased()
            var best: Goal? = nil
            var bestScore = 0
            for g in goals {
                let words = g.title.lowercased().split(separator: " ").filter { $0.count > 3 }
                let score = words.filter { labelLower.contains($0) }.count
                if score > bestScore { bestScore = score; best = g }
            }
            var b = block; b.goal_id = best?.id; return b
        }
        return d
    }
}

func mergeGoalPlan(existing: [DayPlan], newDays: [DayPlan], goalId: String) -> [DayPlan] {
    let newDates = Set(newDays.map { $0.date })
    let allDates = Set(existing.map { $0.date }).union(newDates).sorted()
    return allDates.compactMap { date in
        let existingDay = existing.first { $0.date == date }
        let replacement = newDays.first { $0.date == date }
        guard let existingDay else { return replacement }
        let kept = existingDay.time_blocks.filter { $0.goal_id != goalId }
        let added = replacement?.time_blocks ?? []
        let merged = kept + added
        if merged.isEmpty { return nil }
        var d = existingDay; d.time_blocks = merged; return d
    }
}
