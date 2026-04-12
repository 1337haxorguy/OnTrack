import SwiftUI

struct SchedulePreviewView: View {
    @EnvironmentObject var appState: AppState

    @State private var headerVisible = false
    @State private var statsVisible = false
    @State private var cardsVisible: [Bool] = []

    private let cream = Color(red: 249/255, green: 249/255, blue: 249/255)

    private var plan: [DayPlan] { appState.plan ?? [] }
    private var goalTitle: String { appState.goals.first?.title ?? "your goal" }

    private var totalSessions: Int { plan.reduce(0) { $0 + $1.time_blocks.count } }
    private var totalMinutes: Int {
        plan.reduce(0) { $0 + $1.time_blocks.reduce(0) { $0 + $1.tasks.reduce(0) { $0 + $1.estimated_minutes } } }
    }
    private var activeDays: Int { plan.count }

    var body: some View {
        ZStack(alignment: .bottom) {
            cream.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 20) {

                    // Header: image + chip + title
                    VStack(spacing: 16) {
                        // Goal image placeholder
                        ZStack {
                            RoundedRectangle(cornerRadius: 24)
                                .fill(Color.white)
                                .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
                            Image(systemName: "target")
                                .font(.system(size: 32))
                                .foregroundColor(.black.opacity(0.55))
                        }
                        .frame(width: 113, height: 94)

                        // "your plan is ready" chip
                        Text("your plan is ready")
                            .font(.system(size: 16, weight: .medium))
                            .tracking(-0.32)
                            .foregroundColor(.black)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.black.opacity(0.06))
                            .cornerRadius(999)

                        // Goal title
                        Text(goalTitle.lowercased())
                            .font(.system(size: 40, weight: .semibold))
                            .tracking(-1.2)
                            .foregroundColor(.black)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 250)
                    }
                    .frame(maxWidth: .infinity)
                    .opacity(headerVisible ? 1 : 0)
                    .offset(y: headerVisible ? 0 : 12)

                    // Stats row
                    HStack(spacing: 20) {
                        PreviewStatBox(value: "\(activeDays)", label: "days")
                        PreviewStatBox(value: "\(totalSessions)", label: "sessions")
                        PreviewStatBox(value: formatHours(totalMinutes), label: "hours")
                    }
                    .opacity(statsVisible ? 1 : 0)
                    .offset(y: statsVisible ? 0 : 8)

                    // Day cards
                    VStack(spacing: 20) {
                        ForEach(Array(plan.enumerated()), id: \.offset) { i, day in
                            PreviewDayCard(day: day)
                                .opacity(cardsVisible.indices.contains(i) && cardsVisible[i] ? 1 : 0)
                                .offset(y: cardsVisible.indices.contains(i) && cardsVisible[i] ? 0 : 16)
                        }
                    }

                    Spacer().frame(height: 100)
                }
                .padding(.horizontal, 20)
                .padding(.top, 40)
                .padding(.bottom, 32)
            }

            // Bottom CTA
            VStack(spacing: 12) {
                PrimaryButton(label: "start tracking") {
                    appState.readyForMainApp = true
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 48)
            .opacity(statsVisible ? 1 : 0)
        }
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(cream, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear {
            cardsVisible = Array(repeating: false, count: plan.count)
            withAnimation(.easeOut(duration: 0.45)) { headerVisible = true }
            withAnimation(.easeOut(duration: 0.45).delay(0.15)) { statsVisible = true }
            for i in plan.indices {
                withAnimation(.easeOut(duration: 0.4).delay(0.25 + Double(i) * 0.08)) {
                    cardsVisible[i] = true
                }
            }
        }
    }

    private func formatHours(_ mins: Int) -> String {
        let hours = Double(mins) / 60.0
        let rounded = (hours * 2).rounded() / 2
        if rounded == Double(Int(rounded)) { return "\(Int(rounded))" }
        return String(format: "%.1f", rounded)
    }
}

// MARK: - Stat box

private struct PreviewStatBox: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(.system(size: 32, weight: .medium))
                .tracking(-0.64)
                .foregroundColor(.black)
            Text(label)
                .font(.system(size: 20, weight: .medium))
                .tracking(-0.4)
                .foregroundColor(.black)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(Color.white)
        .cornerRadius(20)
    }
}

// MARK: - Day card

private struct PreviewDayCard: View {
    let day: DayPlan

    private var parsedDate: Date? {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.date(from: day.date)
    }

    private var weekdayName: String {
        guard let d = parsedDate else { return day.date }
        let f = DateFormatter(); f.dateFormat = "EEEE"
        return f.string(from: d).lowercased() + "s"
    }

    private var shortDate: String {
        guard let d = parsedDate else { return "" }
        let f = DateFormatter(); f.dateFormat = "MMMM d"
        return f.string(from: d).lowercased()
    }

    private var totalMins: Int {
        day.time_blocks.reduce(0) { $0 + $1.tasks.reduce(0) { $0 + $1.estimated_minutes } }
    }

    private func durationLabel(_ mins: Int) -> String {
        if mins < 60 { return "\(mins) min" }
        let h = mins / 60
        let m = mins % 60
        return m == 0 ? "\(h) hour\(h == 1 ? "" : "s")" : "\(h)h \(m)m"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {

            // Header: day name + duration chip
            HStack(alignment: .center) {
                Text(weekdayName)
                    .font(.system(size: 20, weight: .medium))
                    .tracking(-0.4)
                    .foregroundColor(.black)
                Spacer()
                HStack(spacing: 5) {
                    Image(systemName: "clock")
                        .font(.system(size: 11))
                        .foregroundColor(.black.opacity(0.6))
                    Text(durationLabel(totalMins))
                        .font(.system(size: 12, weight: .medium))
                        .tracking(-0.24)
                        .foregroundColor(.black)
                }
                .padding(.horizontal, 7)
                .padding(.vertical, 8)
                .cornerRadius(999)
            }

            // Time blocks
            ForEach(day.time_blocks) { block in
                PreviewSessionBlock(block: block, shortDate: shortDate)
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(20)
        .shadow(color: .black.opacity(0.08), radius: 13, x: 0, y: 4)
    }
}

// MARK: - Session block

private struct PreviewSessionBlock: View {
    let block: TimeBlock
    let shortDate: String

    private func formatTime(_ t: String) -> String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        guard let d = f.date(from: t) else { return t }
        let out = DateFormatter(); out.dateFormat = "h:mma"
        return out.string(from: d)
    }

    private func taskEmoji(for title: String) -> String {
        let t = title.lowercased()
        if t.contains("scroll") || t.contains("feed") || t.contains("browse") { return "🤳" }
        if t.contains("film") || t.contains("record") || t.contains("shoot") || t.contains("video") { return "🎬" }
        if t.contains("find") || t.contains("search") || t.contains("research") { return "🔎" }
        if t.contains("write") || t.contains("hook") || t.contains("caption") || t.contains("journa") { return "✍️" }
        if t.contains("edit") || t.contains("cut") || t.contains("trim") { return "✂️" }
        if t.contains("post") || t.contains("publish") || t.contains("upload") || t.contains("share") { return "📱" }
        if t.contains("plan") || t.contains("strategy") || t.contains("outline") || t.contains("prep") { return "📋" }
        if t.contains("read") || t.contains("study") || t.contains("learn") || t.contains("watch") { return "📚" }
        if t.contains("run") || t.contains("jog") || t.contains("sprint") { return "🏃" }
        if t.contains("lift") || t.contains("weight") || t.contains("strength") || t.contains("gym") { return "🏋️" }
        if t.contains("practice") || t.contains("train") || t.contains("drill") || t.contains("repeat") { return "💪" }
        if t.contains("stretch") || t.contains("warm") || t.contains("cool") || t.contains("yoga") { return "🧘" }
        if t.contains("guitar") || t.contains("piano") || t.contains("drum") || t.contains("chord") || t.contains("instrument") { return "🎸" }
        if t.contains("sing") || t.contains("vocal") || t.contains("song") { return "🎤" }
        if t.contains("cook") || t.contains("meal") || t.contains("recipe") || t.contains("food") { return "🍳" }
        if t.contains("draw") || t.contains("sketch") || t.contains("paint") || t.contains("illustrat") { return "🎨" }
        if t.contains("code") || t.contains("program") || t.contains("debug") || t.contains("build") { return "💻" }
        if t.contains("review") || t.contains("analyze") || t.contains("analys") || t.contains("reflect") { return "📊" }
        if t.contains("meditat") || t.contains("breath") || t.contains("mindful") { return "🧘" }
        if t.contains("note") || t.contains("list") || t.contains("log") || t.contains("track") { return "📝" }
        if t.contains("call") || t.contains("meet") || t.contains("discuss") || t.contains("talk") { return "💬" }
        if t.contains("photo") || t.contains("picture") || t.contains("image") { return "📸" }
        if t.contains("walk") || t.contains("hike") || t.contains("outdoor") { return "🚶" }
        if t.contains("danc") || t.contains("choreograph") { return "🩰" }
        if t.contains("language") || t.contains("vocab") || t.contains("grammar") || t.contains("translat") { return "💬" }
        return "🎯"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {

            // Date + time chips
            HStack {
                Text(shortDate)
                    .font(.system(size: 12, weight: .medium))
                    .tracking(-0.24)
                    .foregroundColor(.black)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 8)
                    .background(Color(red: 234/255, green: 234/255, blue: 234/255).opacity(0.76))
                    .cornerRadius(999)

                Spacer()

                if let start = block.start_time, let end = block.end_time {
                    Text("\(formatTime(start)) - \(formatTime(end))")
                        .font(.system(size: 12, weight: .medium))
                        .tracking(-0.24)
                        .foregroundColor(.black)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 8)
                        .cornerRadius(999)
                }
            }

            // Tasks
            ForEach(block.tasks, id: \.title) { task in
                HStack(spacing: 10) {
                    Text(task.emoji ?? taskEmoji(for: task.title))
                        .font(.system(size: 12))
                    Text(task.title)
                        .font(.system(size: 12, weight: .medium))
                        .tracking(-0.24)
                        .foregroundColor(Color(red: 83/255, green: 83/255, blue: 83/255))
                    Spacer()
                }
            }
        }
        .padding(12)
        .background(Color(red: 249/255, green: 249/255, blue: 249/255).opacity(0.7))
        .cornerRadius(16)
    }
}
