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
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 24) {

                        // Header
                        VStack(alignment: .leading, spacing: 10) {
                            Text(goalTitle.lowercased())
                                .font(.system(size: 16, weight: .semibold))
                                .tracking(-0.3)
                                .foregroundColor(.black.opacity(0.35))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(Color.black.opacity(0.06))
                                .cornerRadius(20)

                            Text("your plan\nis ready.")
                                .font(.system(size: 52, weight: .bold))
                                .tracking(-1.56)
                                .foregroundColor(.black)
                        }
                        .opacity(headerVisible ? 1 : 0)
                        .offset(y: headerVisible ? 0 : 12)

                        // Stats row
                        HStack(spacing: 10) {
                            StatChip(value: "\(activeDays)", label: "days")
                            StatChip(value: "\(totalSessions)", label: "sessions")
                            StatChip(value: formatHours(totalMinutes), label: "per week")
                        }
                        .opacity(statsVisible ? 1 : 0)
                        .offset(y: statsVisible ? 0 : 8)

                        // Day cards
                        VStack(spacing: 14) {
                            ForEach(Array(plan.enumerated()), id: \.offset) { i, day in
                                DayPreviewCard(day: day)
                                    .opacity(cardsVisible.indices.contains(i) && cardsVisible[i] ? 1 : 0)
                                    .offset(y: cardsVisible.indices.contains(i) && cardsVisible[i] ? 0 : 16)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
                }

                // CTA
                VStack(spacing: 12) {
                    PrimaryButton(label: "start tracking →") {
                        appState.readyForMainApp = true
                    }
                    Text("you can adjust this anytime")
                        .font(.system(size: 14, weight: .medium))
                        .tracking(-0.28)
                        .foregroundColor(.black.opacity(0.3))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
                .opacity(statsVisible ? 1 : 0)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(cream, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear {
            cardsVisible = Array(repeating: false, count: plan.count)
            // Staggered entrance
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
        if mins < 60 { return "\(mins)m" }
        let h = mins / 60
        let m = mins % 60
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }
}

// MARK: - Stat chip

private struct StatChip: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.84)
                .foregroundColor(.black)
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .tracking(-0.26)
                .foregroundColor(.black.opacity(0.4))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(Color(red: 241/255, green: 241/255, blue: 241/255))
        .cornerRadius(16)
    }
}

// MARK: - Day card

private struct DayPreviewCard: View {
    let day: DayPlan

    private var isToday: Bool {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return day.date == f.string(from: Date())
    }

    private var formattedDate: (weekday: String, date: String) {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: day.date) else { return (day.date, "") }
        let wf = DateFormatter(); wf.dateFormat = "EEEE"
        let df = DateFormatter(); df.dateFormat = "MMM d"
        return (wf.string(from: d).lowercased(), df.string(from: d))
    }

    private var totalMins: Int {
        day.time_blocks.reduce(0) { $0 + $1.tasks.reduce(0) { $0 + $1.estimated_minutes } }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {

            // Date row
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(formattedDate.weekday)
                            .font(.system(size: 20, weight: .semibold))
                            .tracking(-0.6)
                            .foregroundColor(.black)
                        if isToday {
                            Text("today")
                                .font(.system(size: 12, weight: .semibold))
                                .tracking(-0.24)
                                .foregroundColor(.white)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 4)
                                .background(Color.black)
                                .cornerRadius(20)
                        }
                    }
                    Text(formattedDate.date)
                        .font(.system(size: 14, weight: .regular))
                        .tracking(-0.28)
                        .foregroundColor(.black.opacity(0.35))
                }
                Spacer()
                Text("\(totalMins) min")
                    .font(.system(size: 14, weight: .medium))
                    .tracking(-0.28)
                    .foregroundColor(.black.opacity(0.35))
            }

            // Blocks
            VStack(spacing: 6) {
                ForEach(day.time_blocks) { block in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            // Dot accent
                            Circle()
                                .fill(Color.black.opacity(0.15))
                                .frame(width: 7, height: 7)

                            Text(block.label)
                                .font(.system(size: 15, weight: .semibold))
                                .tracking(-0.3)
                                .foregroundColor(.black)

                            Spacer()

                            if let start = block.start_time, let end = block.end_time {
                                Text("\(formatTime(start)) – \(formatTime(end))")
                                    .font(.system(size: 13, weight: .regular))
                                    .tracking(-0.26)
                                    .foregroundColor(.black.opacity(0.35))
                            }
                        }

                        if !block.tasks.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(block.tasks, id: \.title) { task in
                                    HStack(alignment: .top, spacing: 8) {
                                        Circle()
                                            .fill(Color.black.opacity(0.12))
                                            .frame(width: 4, height: 4)
                                            .padding(.top, 5)

                                        VStack(alignment: .leading, spacing: 3) {
                                            HStack {
                                                Text(task.title)
                                                    .font(.system(size: 13, weight: .semibold))
                                                    .tracking(-0.26)
                                                    .foregroundColor(.black.opacity(0.7))
                                                Spacer()
                                                Text("\(task.estimated_minutes)m")
                                                    .font(.system(size: 12))
                                                    .foregroundColor(.black.opacity(0.28))
                                            }
                                            if !task.description.isEmpty {
                                                Text(task.description)
                                                    .font(.system(size: 12, weight: .regular))
                                                    .tracking(-0.24)
                                                    .foregroundColor(.black.opacity(0.42))
                                                    .fixedSize(horizontal: false, vertical: true)
                                            }
                                        }
                                    }
                                }
                            }
                            .padding(.leading, 14)
                            .padding(.top, 2)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Color.white.opacity(isToday ? 0.9 : 0.55))
                    .cornerRadius(12)
                }
            }
        }
        .padding(16)
        .background(
            isToday
                ? Color(red: 235/255, green: 235/255, blue: 230/255)
                : Color(red: 241/255, green: 241/255, blue: 241/255)
        )
        .cornerRadius(20)
        .overlay(
            isToday
                ? RoundedRectangle(cornerRadius: 20).stroke(Color.black.opacity(0.12), lineWidth: 1)
                : nil
        )
    }
}
