import SwiftUI

struct TodayView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    @State private var showRegenSheet = false
    @State private var regenFeedback = ""
    @State private var regenLoading = false
    @State private var regenError = ""

    private var today: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    private var todayPlan: DayPlan? {
        appState.plan?.first { $0.date == today }
    }

    private var todayIndex: Int? {
        appState.plan?.firstIndex { $0.date == today }
    }

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                content
            }
            .navigationTitle("Today")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if todayPlan != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showRegenSheet = true } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .disabled(regenLoading)
                    }
                }
            }
            .sheet(isPresented: $showRegenSheet) {
                RegenSheet(
                    title: "Regenerate today",
                    feedback: $regenFeedback,
                    isLoading: regenLoading,
                    error: regenError,
                    onConfirm: { Task { await regenToday() } },
                    onCancel: { showRegenSheet = false; regenFeedback = ""; regenError = "" }
                )
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if appState.plan == nil {
            noPlanEmpty
        } else if let plan = todayPlan {
            planContent(plan)
        } else {
            freeDayEmpty
        }
    }

    // MARK: - Empty states

    private var noPlanEmpty: some View {
        VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(Color.indigo.opacity(0.2)).frame(width: 64, height: 64)
                Image(systemName: "calendar").font(.system(size: 28)).foregroundColor(.indigo)
            }
            if appState.goals.isEmpty {
                Text("No goals yet").font(.title2.bold()).foregroundColor(.white)
                Text("Create your first goal and OnTrack will build a daily plan to get you there.")
                    .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
            } else {
                Text("No plan generated yet").font(.title2.bold()).foregroundColor(.white)
                Text("You have \(appState.goals.count) goal\(appState.goals.count != 1 ? "s" : "") set up. Head to Goals and tap Generate Plan.")
                    .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
            }
        }
    }

    private var freeDayEmpty: some View {
        let nextDay = appState.plan?.first { $0.date > today }
        let nextLabel = nextDay.map { d -> String in
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
            guard let date = f.date(from: d.date) else { return d.date }
            return date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
        }
        return VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.06)).frame(width: 64, height: 64)
                Image(systemName: "checkmark.circle").font(.system(size: 28)).foregroundColor(.gray)
            }
            Text("Free day").font(.title2.bold()).foregroundColor(.white)
            if let label = nextLabel {
                Text("Nothing scheduled today. Next session is \(label).")
                    .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
            } else {
                Text("Nothing else scheduled this week. Generate a new plan when you're ready.")
                    .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
            }
        }
    }

    // MARK: - Plan content

    private func planContent(_ plan: DayPlan) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                // Focus card
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10).fill(Color.indigo.opacity(0.2)).frame(width: 36, height: 36)
                        Image(systemName: "scope").foregroundColor(.indigo)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Today's focus").font(.caption).foregroundColor(.gray)
                        Text(plan.objective).font(.subheadline).foregroundColor(Color(white: 0.85))
                    }
                    Spacer()
                }
                .padding(14)
                .background(Color.white.opacity(0.04))
                .cornerRadius(14)

                // Time blocks
                ForEach(Array(plan.time_blocks.enumerated()), id: \.offset) { bi, block in
                    TodayBlockCard(block: block, blockIndex: bi, dayIndex: todayIndex ?? 0)
                }
            }
            .padding(16)
        }
    }

    // MARK: - Regen today

    private func regenToday() async {
        regenLoading = true; regenError = ""
        let plan = todayPlan
        do {
            let token = await auth.getToken()
            var newDay = try await APIService.regenerateDay(
                date: today,
                goals: appState.goals,
                schedule: appState.schedule,
                feedback: regenFeedback.isEmpty ? nil : regenFeedback,
                currentPlan: plan,
                token: token
            )
            newDay.time_blocks = newDay.time_blocks.map { var b = $0; b.id = UUID().uuidString; return b }
            if let idx = appState.plan?.firstIndex(where: { $0.date == today }) {
                appState.plan![idx] = newDay
            } else {
                appState.plan = (appState.plan ?? []) + [newDay]
            }
            if let token { appState.queueSync(token: token) }
            regenFeedback = ""; regenError = ""; showRegenSheet = false
        } catch {
            regenError = "Failed to regenerate. Try again."
        }
        regenLoading = false
    }
}

// MARK: - Block card

struct TodayBlockCard: View {
    let block: TimeBlock
    let blockIndex: Int
    let dayIndex: Int

    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var expanded = true
    @State private var showRegenSheet = false
    @State private var regenFeedback = ""
    @State private var regenLoading = false
    @State private var regenError = ""

    private var allDone: Bool { block.tasks.allSatisfy { $0.completed == true } }
    private var someDone: Bool { !allDone && block.tasks.contains { $0.completed == true } }
    private var date: String { appState.plan?[dayIndex].date ?? "" }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header: checkbox | expand area | menu
            HStack(spacing: 10) {
                Button { toggleBlock() } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(allDone ? Color.indigo : Color.white.opacity(0.2), lineWidth: 1.5)
                            .frame(width: 22, height: 22)
                        if allDone {
                            Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundColor(.indigo)
                        } else if someDone {
                            Rectangle().fill(Color.indigo.opacity(0.5)).frame(width: 10, height: 2)
                        }
                    }
                }
                .buttonStyle(.plain)

                Button { withAnimation(.spring(duration: 0.25)) { expanded.toggle() } } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(block.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(allDone ? .gray : .white)
                                .strikethrough(allDone)
                            if let start = block.start_time, let end = block.end_time {
                                Text("\(formatTime(start)) – \(formatTime(end))")
                                    .font(.caption).foregroundColor(.gray)
                            }
                        }
                        Spacer()
                        Image(systemName: expanded ? "chevron.up" : "chevron.down")
                            .font(.caption).foregroundColor(.gray)
                    }
                }
                .buttonStyle(.plain)

                Menu {
                    Button {
                        showRegenSheet = true
                    } label: {
                        Label("Regenerate block", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 15))
                        .foregroundColor(.gray)
                        .frame(width: 28, height: 28)
                }
            }
            .padding(14)

            // Tasks
            if expanded {
                Divider().background(Color.white.opacity(0.06))
                ForEach(Array(block.tasks.enumerated()), id: \.offset) { ti, task in
                    TaskRow(task: task, blockIndex: blockIndex, taskIndex: ti, dayIndex: dayIndex)
                    if ti < block.tasks.count - 1 {
                        Divider().background(Color.white.opacity(0.04)).padding(.leading, 46)
                    }
                }
            }
        }
        .background(Color.white.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
        .cornerRadius(14)
        .sheet(isPresented: $showRegenSheet) {
            RegenSheet(
                title: "Regenerate \"\(block.label)\"",
                feedback: $regenFeedback,
                isLoading: regenLoading,
                error: regenError,
                onConfirm: { Task { await regenBlock() } },
                onCancel: { showRegenSheet = false; regenFeedback = ""; regenError = "" }
            )
        }
    }

    private func toggleBlock() {
        guard appState.plan != nil, dayIndex < appState.plan!.count else { return }
        let allCurrentlyDone = block.tasks.allSatisfy { $0.completed == true }
        appState.plan![dayIndex].time_blocks[blockIndex].tasks = block.tasks.map {
            var t = $0; t.completed = !allCurrentlyDone; return t
        }
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }

    private func regenBlock() async {
        regenLoading = true; regenError = ""
        let currentPlan = appState.plan?[dayIndex]
        let feedback = regenFeedback.isEmpty
            ? "Regenerate the \"\(block.label)\" block with fresh content."
            : "For the \"\(block.label)\" block: \(regenFeedback)"
        do {
            let token = await auth.getToken()
            var newDay = try await APIService.regenerateDay(
                date: date,
                goals: appState.goals,
                schedule: appState.schedule,
                feedback: feedback,
                currentPlan: currentPlan,
                token: token
            )
            newDay.time_blocks = newDay.time_blocks.map { var b = $0; b.id = UUID().uuidString; return b }
            guard appState.plan != nil, dayIndex < appState.plan!.count else { return }
            appState.plan![dayIndex] = newDay
            if let token { appState.queueSync(token: token) }
            regenFeedback = ""; regenError = ""; showRegenSheet = false
        } catch {
            regenError = "Failed to regenerate. Try again."
        }
        regenLoading = false
    }
}

// MARK: - Task row

struct TaskRow: View {
    let task: PlanTask
    let blockIndex: Int
    let taskIndex: Int
    let dayIndex: Int

    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var showDesc = false
    @State private var showEditSheet = false
    @State private var showRegenSheet = false
    @State private var editedTask: PlanTask
    @State private var regenFeedback = ""
    @State private var regenLoading = false
    @State private var regenError = ""

    init(task: PlanTask, blockIndex: Int, taskIndex: Int, dayIndex: Int) {
        self.task = task
        self.blockIndex = blockIndex
        self.taskIndex = taskIndex
        self.dayIndex = dayIndex
        _editedTask = State(initialValue: task)
    }

    private var isDone: Bool { task.completed == true }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Button { toggle() } label: {
                    ZStack {
                        Circle().stroke(isDone ? Color.indigo : Color.white.opacity(0.2), lineWidth: 1.5).frame(width: 20, height: 20)
                        if isDone { Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundColor(.indigo) }
                    }
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 2) {
                    Text(task.title)
                        .font(.subheadline)
                        .foregroundColor(isDone ? .gray : .white)
                        .strikethrough(isDone)
                    Text("\(task.estimated_minutes) min")
                        .font(.caption2).foregroundColor(.gray)
                }

                Spacer()

                if !task.description.isEmpty {
                    Button { withAnimation { showDesc.toggle() } } label: {
                        Image(systemName: showDesc ? "chevron.up" : "chevron.down")
                            .font(.caption).foregroundColor(.gray)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
            .contextMenu {
                Button {
                    editedTask = task
                    showEditSheet = true
                } label: {
                    Label("Edit task", systemImage: "pencil")
                }
                Button {
                    showRegenSheet = true
                } label: {
                    Label("Regenerate day", systemImage: "arrow.clockwise")
                }
            }

            if showDesc && !task.description.isEmpty {
                Text(task.description)
                    .font(.caption)
                    .foregroundColor(.gray)
                    .padding(.horizontal, 46)
                    .padding(.bottom, 10)
            }
        }
        .sheet(isPresented: $showEditSheet) {
            EditTaskSheet(task: $editedTask) { saveEdit() }
        }
        .sheet(isPresented: $showRegenSheet) {
            RegenSheet(
                title: "Regenerate day",
                feedback: $regenFeedback,
                isLoading: regenLoading,
                error: regenError,
                onConfirm: { Task { await regenDay() } },
                onCancel: { showRegenSheet = false; regenFeedback = ""; regenError = "" }
            )
        }
    }

    private func toggle() {
        guard appState.plan != nil, dayIndex < appState.plan!.count else { return }
        appState.plan![dayIndex].time_blocks[blockIndex].tasks[taskIndex].completed = !isDone
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }

    private func saveEdit() {
        guard appState.plan != nil, dayIndex < appState.plan!.count else { return }
        appState.plan![dayIndex].time_blocks[blockIndex].tasks[taskIndex] = editedTask
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
        showEditSheet = false
    }

    private func regenDay() async {
        regenLoading = true; regenError = ""
        let date = appState.plan?[dayIndex].date ?? ""
        let currentPlan = appState.plan?[dayIndex]
        let feedback = regenFeedback.isEmpty
            ? "Replace the task \"\(task.title)\" with improved content."
            : "For the task \"\(task.title)\": \(regenFeedback)"
        do {
            let token = await auth.getToken()
            var newDay = try await APIService.regenerateDay(
                date: date,
                goals: appState.goals,
                schedule: appState.schedule,
                feedback: feedback,
                currentPlan: currentPlan,
                token: token
            )
            newDay.time_blocks = newDay.time_blocks.map { var b = $0; b.id = UUID().uuidString; return b }
            guard appState.plan != nil, dayIndex < appState.plan!.count else { return }
            appState.plan![dayIndex] = newDay
            if let token { appState.queueSync(token: token) }
            regenFeedback = ""; regenError = ""; showRegenSheet = false
        } catch {
            regenError = "Failed to regenerate. Try again."
        }
        regenLoading = false
    }
}

func formatTime(_ t: String) -> String {
    let parts = t.split(separator: ":").compactMap { Int($0) }
    guard parts.count >= 2 else { return t }
    let h = parts[0]; let m = parts[1]
    let period = h < 12 ? "AM" : "PM"
    let hour = h % 12 == 0 ? 12 : h % 12
    return m == 0 ? "\(hour) \(period)" : "\(hour):\(String(format: "%02d", m)) \(period)"
}
