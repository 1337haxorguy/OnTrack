import SwiftUI

struct CalendarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var selectedDate: String? = nil
    @State private var generating = false

    private var today: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }

    private var sortedDays: [DayPlan] {
        (appState.plan ?? []).sorted { $0.date < $1.date }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if appState.plan == nil || appState.plan!.isEmpty {
                    emptyState
                } else {
                    dayList
                }
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16).fill(Color.indigo.opacity(0.2)).frame(width: 64, height: 64)
                Image(systemName: "calendar").font(.system(size: 28)).foregroundColor(.indigo)
            }
            if appState.goals.isEmpty {
                Text("No goals yet").font(.title2.bold()).foregroundColor(.white)
                Text("Create a goal first, then generate your weekly plan.")
                    .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
            } else {
                Text("Calendar is empty").font(.title2.bold()).foregroundColor(.white)
                Text("Generate a plan from your \(appState.goals.count) goal\(appState.goals.count != 1 ? "s" : "") to fill your week.")
                    .font(.subheadline).foregroundColor(.gray).multilineTextAlignment(.center).padding(.horizontal, 40)
                Button {
                    Task { await generatePlan() }
                } label: {
                    HStack {
                        if generating { ProgressView().tint(.white).scaleEffect(0.8) }
                        Text(generating ? "Generating…" : "Generate Plan").font(.subheadline.weight(.semibold))
                    }
                    .padding(.horizontal, 24).padding(.vertical, 12)
                    .background(Color.indigo).foregroundColor(.white).cornerRadius(12)
                }
                .disabled(generating)
            }
        }
    }

    // MARK: - Day list

    private var dayList: some View {
        ScrollView {
            VStack(spacing: 2) {
                ForEach(sortedDays) { day in
                    CalendarDaySection(
                        day: day,
                        isToday: day.date == today,
                        isPast: day.date < today,
                        isExpanded: selectedDate == day.date,
                        onTap: {
                            withAnimation(.spring(duration: 0.3)) {
                                selectedDate = selectedDate == day.date ? nil : day.date
                            }
                        }
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    private func generatePlan() async {
        generating = true
        do {
            let token = await auth.getToken()
            let newDays = try await APIService.generatePlan(goals: appState.goals, schedule: appState.schedule, token: token)
            appState.plan = attributeBlocks(plan: newDays, goals: appState.goals)
            if let token { appState.queueSync(token: token) }
            appState.showToast("Your plan is ready!")
        } catch {
            appState.showToast("Failed to generate plan. Try again.")
        }
        generating = false
    }
}

// MARK: - Day section

struct CalendarDaySection: View {
    let day: DayPlan
    let isToday: Bool
    let isPast: Bool
    let isExpanded: Bool
    let onTap: () -> Void

    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    private var dayLabel: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: day.date) else { return day.date }
        return d.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }

    private var completedCount: Int { day.time_blocks.flatMap { $0.tasks }.filter { $0.completed == true }.count }
    private var totalCount: Int { day.time_blocks.flatMap { $0.tasks }.count }

    var body: some View {
        VStack(spacing: 0) {
            // Day header
            Button(action: onTap) {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(dayLabel)
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(isPast ? .gray : (isToday ? .indigo : .white))
                            if isToday {
                                Text("Today")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Color.indigo).foregroundColor(.white).cornerRadius(4)
                            }
                        }
                        Text("\(day.time_blocks.count) block\(day.time_blocks.count != 1 ? "s" : "") · \(completedCount)/\(totalCount) tasks done")
                            .font(.caption).foregroundColor(.gray)
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption).foregroundColor(.gray)
                }
                .padding(14)
                .background(Color.white.opacity(isToday ? 0.06 : 0.03))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(isToday ? Color.indigo.opacity(0.3) : Color.white.opacity(0.06), lineWidth: 1))
                .cornerRadius(14)
            }
            .buttonStyle(.plain)

            // Expanded blocks
            if isExpanded {
                VStack(spacing: 8) {
                    ForEach(Array(day.time_blocks.enumerated()), id: \.offset) { bi, block in
                        CalendarBlockCard(block: block, blockIndex: bi, day: day)
                    }
                }
                .padding(.top, 8)
                .padding(.leading, 16)
            }
        }
        .padding(.bottom, 8)
    }
}

// MARK: - Calendar block card

struct CalendarBlockCard: View {
    let block: TimeBlock
    let blockIndex: Int
    let day: DayPlan

    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var showTasks = false

    private var dayIndex: Int? { appState.plan?.firstIndex { $0.date == day.date } }
    private var allDone: Bool { block.tasks.allSatisfy { $0.completed == true } }
    private var someDone: Bool { !allDone && block.tasks.contains { $0.completed == true } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation { showTasks.toggle() } } label: {
                HStack(spacing: 10) {
                    // Checkbox
                    Button { toggleBlock() } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 5)
                                .stroke(allDone ? Color.indigo : Color.white.opacity(0.2), lineWidth: 1.5)
                                .frame(width: 20, height: 20)
                            if allDone {
                                Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundColor(.indigo)
                            } else if someDone {
                                Rectangle().fill(Color.indigo.opacity(0.5)).frame(width: 8, height: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(block.label)
                            .font(.subheadline)
                            .foregroundColor(allDone ? .gray : .white)
                            .strikethrough(allDone)
                        if let start = block.start_time, let end = block.end_time {
                            Text("\(formatTime(start)) – \(formatTime(end))")
                                .font(.caption).foregroundColor(.gray)
                        }
                    }
                    Spacer()
                    Text("\(block.tasks.count) task\(block.tasks.count != 1 ? "s" : "")")
                        .font(.caption2).foregroundColor(.gray)
                    Image(systemName: showTasks ? "chevron.up" : "chevron.down")
                        .font(.caption2).foregroundColor(.gray)
                }
                .padding(12)
            }
            .buttonStyle(.plain)

            if showTasks {
                Divider().background(Color.white.opacity(0.06))
                ForEach(Array(block.tasks.enumerated()), id: \.offset) { ti, task in
                    CalendarTaskRow(task: task, blockIndex: blockIndex, taskIndex: ti, day: day)
                    if ti < block.tasks.count - 1 {
                        Divider().background(Color.white.opacity(0.04)).padding(.leading, 42)
                    }
                }
            }
        }
        .background(Color.white.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.07), lineWidth: 1))
        .cornerRadius(12)
    }

    private func toggleBlock() {
        guard let di = dayIndex, appState.plan != nil else { return }
        let allCurrentlyDone = block.tasks.allSatisfy { $0.completed == true }
        appState.plan![di].time_blocks[blockIndex].tasks = block.tasks.map { var t = $0; t.completed = !allCurrentlyDone; return t }
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }
}

struct CalendarTaskRow: View {
    let task: PlanTask
    let blockIndex: Int
    let taskIndex: Int
    let day: DayPlan

    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var showDesc = false

    private var isDone: Bool { task.completed == true }
    private var dayIndex: Int? { appState.plan?.firstIndex { $0.date == day.date } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Button { toggle() } label: {
                    ZStack {
                        Circle().stroke(isDone ? Color.indigo : Color.white.opacity(0.2), lineWidth: 1.5).frame(width: 18, height: 18)
                        if isDone { Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundColor(.indigo) }
                    }
                }
                .buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 1) {
                    Text(task.title).font(.caption).foregroundColor(isDone ? .gray : .white).strikethrough(isDone)
                    Text("\(task.estimated_minutes) min").font(.caption2).foregroundColor(.gray)
                }
                Spacer()
                if !task.description.isEmpty {
                    Button { withAnimation { showDesc.toggle() } } label: {
                        Image(systemName: showDesc ? "chevron.up" : "chevron.down").font(.caption2).foregroundColor(.gray)
                    }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)

            if showDesc {
                Text(task.description).font(.caption2).foregroundColor(.gray)
                    .padding(.horizontal, 40).padding(.bottom, 8)
            }
        }
    }

    private func toggle() {
        guard let di = dayIndex, appState.plan != nil else { return }
        appState.plan![di].time_blocks[blockIndex].tasks[taskIndex].completed = !isDone
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }
}
