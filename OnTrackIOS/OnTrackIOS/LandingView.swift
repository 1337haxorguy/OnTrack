import SwiftUI

// MARK: - Landing (Login) Screen

struct LandingView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var cardOffsets: [CGFloat] = [0, 0, 0, 0]
    @State private var showGoalCreation = false
    @StateObject private var flowState = OnboardingFlowState()

    private let cream = Color(red: 251/255, green: 250/255, blue: 247/255)

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Fanned goal-card stack
                cardFan
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 12)
                    .onAppear { bounceCards() }

                // "ON TRACK" + subtitle + CTA
                VStack(spacing: 20) {
                    onTrackTitle
                        .padding(.top, 80)

                    VStack(spacing: 40) {
                        Text("create weekly plans for your personal goals + hobbbies")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundColor(.black.opacity(0.4))
                            .multilineTextAlignment(.center)
                            .tracking(-0.66)

                        PrimaryButton(label: "get started →") {
                            withAnimation(.easeInOut(duration: 0.35)) {
                                showGoalCreation = true
                            }
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }

            if showGoalCreation {
                NavigationStack {
                    GoalCreationView {
                        withAnimation(.easeInOut(duration: 0.35)) {
                            showGoalCreation = false
                        }
                    }
                }
                .environmentObject(flowState)
                .transition(.opacity)
                .ignoresSafeArea()
            }
        }
    }

    // MARK: - Goal card fan

    private var cardFan: some View {
        ZStack(alignment: .topLeading) {
            Color.clear.frame(width: 318, height: 354)

            // Cards ordered back→front; bounce index 3→0 (front bounces first)
            LandingGoalCard(
                imageName: "card_baking2",
                title: "baking",
                schedule: "mondays | 30 minutes",
                task: "sketch human faces"
            )
            .frame(width: 200, height: 275)
            .offset(x: 118, y: cardOffsets[3])

            LandingGoalCard(
                imageName: "card_baking1",
                title: "baking",
                schedule: "mondays | 30 minutes",
                task: "gather recipe inspo online"
            )
            .frame(width: 200, height: 275)
            .offset(x: 77, y: 30 + cardOffsets[2])

            LandingGoalCard(
                imageName: "card_guitar",
                title: "learn guitar",
                schedule: "wednesdays | 30 minutes",
                task: "practice plucking techniques"
            )
            .frame(width: 200, height: 275)
            .offset(x: 36, y: 49 + cardOffsets[1])

            LandingGoalCard(
                imageName: "card_novel",
                title: "novel writing",
                schedule: "saturdays | 1 hour",
                task: "plan out plot"
            )
            .frame(width: 200, height: 275)
            .offset(x: 0, y: 79 + cardOffsets[0])
        }
    }

    // MARK: - Bounce animation (front card first, then back)

    private func bounceCards() {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_200_000_000) // let view settle
            for i in 0..<4 {
                withAnimation(.easeOut(duration: 0.15)) { cardOffsets[i] = -20 }
                try? await Task.sleep(nanoseconds: 150_000_000)
                withAnimation(.easeIn(duration: 0.15)) { cardOffsets[i] = 0 }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }

    // MARK: - "ON TRACK" curved path letters

    // Offsets derived from Figma absolute positions (relative to ZStack center).
    private var onTrackTitle: some View {
        ZStack {
            curvedLetter("O", offsetX: -128, offsetY: 18,  rotation: -22.17)
            curvedLetter("N", offsetX: -89,  offsetY: -1,  rotation: -16.07)
            curvedLetter("T", offsetX: -32,  offsetY: -8,  rotation:   6.13)
            curvedLetter("R", offsetX:   6,  offsetY:  1,  rotation:   6.13)
            curvedLetter("A", offsetX:  45,  offsetY:  3,  rotation:   6.13)
            curvedLetter("C", offsetX:  85,  offsetY:  1,  rotation:  -7.48)
            curvedLetter("K", offsetX: 128,  offsetY: -18, rotation: -25.32)
        }
        .frame(maxWidth: .infinity, minHeight: 105, maxHeight: 105)
    }

    private func curvedLetter(
        _ char: String,
        offsetX: CGFloat,
        offsetY: CGFloat,
        rotation: Double
    ) -> some View {
        Text(char)
            .font(.system(size: 58, weight: .bold))
            .tracking(-1.74)
            .foregroundColor(.black)
            .rotationEffect(.degrees(rotation))
            .offset(x: offsetX, y: offsetY)
    }
}

// MARK: - Goal card component (landing only)

private struct LandingGoalCard: View {
    let imageName: String
    let title: String
    let schedule: String
    let task: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Image(imageName)
                .resizable()
                .scaledToFill()

            // Bottom fade gradient
            LinearGradient(
                colors: [.clear, .black.opacity(0.5)],
                startPoint: UnitPoint(x: 0.5, y: 0.02),
                endPoint: UnitPoint(x: 0.5, y: 0.98)
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(.white)
                    .tracking(-0.51)

                Text(schedule)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.64))
                    .tracking(-0.34)

                Text(task)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.white.opacity(0.64))
                    .tracking(-0.34)
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.white.opacity(0.5), lineWidth: 0.85)
        )
    }
}
