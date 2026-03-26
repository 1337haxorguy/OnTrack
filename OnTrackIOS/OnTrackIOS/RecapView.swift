import SwiftUI

struct RecapView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    @State private var notes = ""
    @State private var generating = false
    @State private var error = ""

    private var today: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    private var pastDays: [DayPlan] {
        (appState.plan ?? []).filter { $0.date <= today }.sorted { $0.date < $1.date }
    }

    private var totalTasks: Int { pastDays.flatMap { $0.time_blocks.flatMap { $0.tasks } }.count }
    private var completedTasks: Int { pastDays.flatMap { $0.time_blocks.flatMap { $0.tasks } }.filter { $0.completed == true }.count }
    private var completionRate: Int { totalTasks > 0 ? Int(Double(completedTasks) / Double(totalTasks) * 100) : 0 }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if appState.plan == nil || pastDays.isEmpty {
                    emptyState
                } else {
                    recapContent
                }
            }
            .navigationTitle("Weekly Recap")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(Color.indigo.opacity(0.2)).frame(width: 64, height: 64)
                Image(systemName: "checkmark.circle").font(.system(size: 28)).foregroundColor(.indigo)
            }
            Text("No recap yet").font(.title2.bold()).foregroundColor(.white)
            Text("Your weekly recap will appear here once you have a plan in progress.")
                .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
        }
    }

    // MARK: - Recap content

    private var recapContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Stats card
                HStack(spacing: 0) {
                    statCell(value: "\(completionRate)%", label: "Completion")
                    Divider().background(Color.white.opacity(0.08)).frame(height: 40)
                    statCell(value: "\(completedTasks)", label: "Done")
                    Divider().background(Color.white.opacity(0.08)).frame(height: 40)
                    statCell(value: "\(totalTasks - completedTasks)", label: "Skipped")
                }
                .padding(16)
                .background(Color.white.opacity(0.04))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
                .cornerRadius(14)

                // Days
                ForEach(pastDays) { day in
                    RecapDayCard(day: day)
                }

                // Notes + generate
                VStack(alignment: .leading, spacing: 10) {
                    Text("Notes for next week")
                        .font(.caption.weight(.medium)).foregroundColor(.gray)
                    TextEditor(text: $notes)
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .frame(minHeight: 80)
                        .padding(10)
                        .background(Color.white.opacity(0.04))
                        .cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.08), lineWidth: 1))
                        .scrollContentBackground(.hidden)

                    if !error.isEmpty {
                        Text(error).font(.caption).foregroundColor(.red)
                    }

                    Button { Task { await generateNextWeek() } } label: {
                        HStack {
                            if generating { ProgressView().tint(.white).scaleEffect(0.8) }
                            Text(generating ? "Generating…" : "Generate next week →").font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.indigo).foregroundColor(.white).cornerRadius(12)
                    }
                    .disabled(generating)
                }
                .padding(14)
                .background(Color.white.opacity(0.04))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
                .cornerRadius(14)
            }
            .padding(16)
        }
    }

    private func statCell(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.title2.bold()).foregroundColor(.white)
            Text(label).font(.caption2).foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Generate next week

    private func generateNextWeek() async {
        generating = true
        error = ""

        // Calculate next Monday
        let cal = Calendar.current
        let now = Date()
        let weekday = cal.component(.weekday, from: now) // 1=Sun, 2=Mon...
        let daysUntilMonday = weekday == 2 ? 7 : (9 - weekday) % 7
        guard let nextMonday = cal.date(byAdding: .day, value: daysUntilMonday, to: now),
              let nextSunday = cal.date(byAdding: .day, value: 6, to: nextMonday) else {
            error = "Could not calculate next week dates."
            generating = false
            return
        }

        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let weekStart = f.string(from: nextMonday)
        let weekEnd = f.string(from: nextSunday)

        _ = buildPreviousWeekContext()

        let goalsForNextWeek = appState.goals.map { g -> Goal in
            var g = g; g.timeframe = Timeframe(start_date: weekStart, end_date: weekEnd); return g
        }

        do {
            let token = await auth.getToken()
            var newDays = try await APIService.generatePlan(goals: goalsForNextWeek, schedule: appState.schedule, token: token)
            newDays = newDays.map { day in
                var d = day
                d.time_blocks = d.time_blocks.map { var b = $0; b.id = UUID().uuidString; return b }
                return d
            }
            let newDates = Set(newDays.map { $0.date })
            let kept = (appState.plan ?? []).filter { !newDates.contains($0.date) }
            appState.plan = (kept + newDays).sorted { $0.date < $1.date }
            if let token { appState.queueSync(token: token) }
            appState.showToast("Next week's plan is ready!", actionLabel: "View calendar →", actionRoute: .calendar)
        } catch {
            self.error = "Failed to generate. Try again."
        }
        generating = false
    }

    private func buildPreviousWeekContext() -> [String: Any] {
        let taskDetails = pastDays.flatMap { day in
            day.time_blocks.flatMap { block in
                block.tasks.map { task -> [String: Any] in
                    ["title": task.title, "block": block.label, "completed": task.completed ?? false]
                }
            }
        }
        return [
            "total_tasks": totalTasks,
            "completed_tasks": completedTasks,
            "notes": notes,
            "task_details": taskDetails
        ]
    }
}

// MARK: - Recap day card

struct RecapDayCard: View {
    let day: DayPlan
    @State private var expanded = false

    private var dayLabel: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: day.date) else { return day.date }
        return d.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }

    private var done: Int { day.time_blocks.flatMap { $0.tasks }.filter { $0.completed == true }.count }
    private var total: Int { day.time_blocks.flatMap { $0.tasks }.count }

    var body: some View {
        VStack(spacing: 0) {
            Button { withAnimation(.spring(duration: 0.25)) { expanded.toggle() } } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dayLabel).font(.subheadline.weight(.semibold)).foregroundColor(.white)
                        Text("\(done)/\(total) tasks completed").font(.caption).foregroundColor(.gray)
                    }
                    Spacer()
                    // Mini progress bar
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.08)).frame(width: 60, height: 4)
                        if total > 0 {
                            Capsule().fill(Color.indigo).frame(width: 60 * CGFloat(done) / CGFloat(total), height: 4)
                        }
                    }
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption).foregroundColor(.gray).padding(.leading, 8)
                }
                .padding(14)
            }
            .buttonStyle(.plain)

            if expanded {
                Divider().background(Color.white.opacity(0.06))
                ForEach(day.time_blocks, id: \.id) { block in
                    RecapBlockSection(block: block)
                }
            }
        }
        .background(Color.white.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
        .cornerRadius(14)
    }
}

struct RecapBlockSection: View {
    let block: TimeBlock
    @State private var expandedTask: Int? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(block.label).font(.caption.weight(.semibold)).foregroundColor(.gray)
                .padding(.horizontal, 14).padding(.top, 10).padding(.bottom, 6)

            ForEach(Array(block.tasks.enumerated()), id: \.offset) { ti, task in
                let isDone = task.completed == true
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(isDone ? .indigo : Color.white.opacity(0.2))
                            .font(.system(size: 16))
                        Text(task.title).font(.caption).foregroundColor(isDone ? .gray : .white).strikethrough(isDone)
                        Spacer()
                        if !task.description.isEmpty {
                            Button { withAnimation { expandedTask = expandedTask == ti ? nil : ti } } label: {
                                Image(systemName: expandedTask == ti ? "chevron.up" : "chevron.down")
                                    .font(.caption2).foregroundColor(.gray)
                            }.buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 14).padding(.vertical, 8)

                    if expandedTask == ti {
                        Text(task.description).font(.caption2).foregroundColor(.gray)
                            .padding(.horizontal, 40).padding(.bottom, 8)
                    }
                }
                if ti < block.tasks.count - 1 {
                    Divider().background(Color.white.opacity(0.04)).padding(.leading, 40)
                }
            }
        }
    }
}
