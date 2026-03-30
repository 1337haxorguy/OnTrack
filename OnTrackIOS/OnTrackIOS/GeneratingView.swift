import SwiftUI

struct GeneratingView: View {
    @EnvironmentObject var flowState: OnboardingFlowState
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    @State private var cardOffset: CGFloat = 0
    @State private var failed = false

    var body: some View {
        ZStack {
            GeometryReader { geo in
                Image("splash_bg")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geo.size.width * 1.88, height: geo.size.height * 1.08)
                    .offset(x: geo.size.width * -0.24, y: geo.size.height * -0.07)
                    .clipped()
            }
            .ignoresSafeArea()

            Color.black.opacity(0.25).ignoresSafeArea()

            VStack(spacing: 40) {
                HStack {
                    Spacer()
                    Image(systemName: "sparkle")
                        .font(.system(size: 52, weight: .semibold))
                        .foregroundColor(.white)
                        .rotationEffect(.degrees(10.12))
                        .offset(x: -24, y: 0)
                }

                whiteCard
                    .offset(y: cardOffset)
                    .animation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true), value: cardOffset)

                HStack {
                    Image(systemName: "sparkle")
                        .font(.system(size: 52, weight: .semibold))
                        .foregroundColor(.white)
                        .rotationEffect(.degrees(-18.74))
                        .offset(x: 24, y: 0)
                    Spacer()
                }

                if failed {
                    Text("Something went wrong.\nYou can try again from the Goals tab.")
                        .font(.system(size: 22, weight: .medium))
                        .tracking(-0.66)
                        .foregroundColor(.white.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .frame(width: 309)
                } else {
                    Text("generating your\nschedule...")
                        .font(.system(size: 40, weight: .bold))
                        .tracking(-1.2)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .frame(width: 309)
                }
            }
            .padding(.horizontal, 24)
        }
        .onAppear {
            DispatchQueue.main.async { cardOffset = -14 }
            Task { await buildGoalAndGenerate() }
        }
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - White preview card

    private var whiteCard: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.white)
                .shadow(color: Color.white.opacity(0.25), radius: 15, x: 0, y: 0)

            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 20) {
                    Text("sunday")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color(red: 160/255, green: 160/255, blue: 160/255))
                    Text("monday")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color(red: 160/255, green: 160/255, blue: 160/255))
                }
                VStack(spacing: 10) {
                    ForEach(0..<5, id: \.self) { i in
                        Capsule()
                            .fill(Color(red: 230/255, green: 230/255, blue: 230/255))
                            .frame(width: skeletonWidth(i), height: 10)
                    }
                }
            }
            .padding(20)
        }
        .frame(width: 192, height: 284)
        .rotationEffect(.degrees(-5))
    }

    private func skeletonWidth(_ index: Int) -> CGFloat {
        [140, 110, 130, 90, 120][index]
    }

    // MARK: - Build goal + generate

    private func buildGoalAndGenerate() async {
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
        let today = df.string(from: Date())
        let endDate = df.string(from: Calendar.current.date(byAdding: .month, value: 1, to: Date())!)

        // Pair questions with answers; last one is the "anything else?" we appended
        let allPairs = Array(zip(flowState.questions, flowState.answers))
        let aiPairs = allPairs.dropLast()
        let additionalContext = allPairs.last?.1 ?? ""

        let answeredQuestions = aiPairs.map { q, a in
            FollowupQuestion(question: q.question, user_response: a, type: q.type, options: q.options)
        }

        let goal = Goal(
            id: UUID().uuidString,
            title: flowState.goalText,
            skill_level: .beginner,
            timeframe: Timeframe(start_date: today, end_date: endDate),
            restrictions: [],
            requests: [],
            additional_context: additionalContext,
            followup_questions: answeredQuestions,
            hours_per_week: 4,
            has_daily_limit: false,
            daily_limit_minutes: 60,
            selected_days: ALL_DAYS
        )

        appState.goals.append(goal)

        do {
            let token = await auth.getToken()
            let newDays = try await APIService.generatePlan(
                goals: [goal],
                schedule: appState.schedule,
                token: token
            )
            appState.plan = attributeBlocks(plan: newDays, goals: appState.goals)
            if let token { appState.queueSync(token: token) }
            flowState.shouldDismissOnboarding = true
        } catch {
            appState.goals.removeAll { $0.id == goal.id }
            failed = true
        }
    }
}
