import SwiftUI

struct GoalCreationView: View {
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var flowState: OnboardingFlowState
    var onBack: () -> Void = {}

    @State private var goalText = ""
    @State private var selectedChip: String? = nil
    @State private var appeared = false
    @State private var navigateNext = false

    private let cream = Color(red: 249/255, green: 249/255, blue: 249/255)

    private let suggestions = [
        "working out 🏋️‍♀️", "running 🏃🏻", "dj 🎧",
        "writing a book 📝", "content creation 🤳", "dancing 🩰",
        "playing an instrument 🎸", "learning a language 💬",
        "coding an app 💻", "painting 🖌️", "meditation 🧘🏻"
    ]

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                StepProgressBar(steps: 6, current: 1)
                    .padding(.horizontal, 24)
                    .padding(.top, 32)
                    .padding(.bottom, 40)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("what's a goal you want to achieve?")
                                .font(.system(size: 32, weight: .semibold))
                                .tracking(-0.96)
                                .foregroundColor(.black)

                            Text("anything counts!")
                                .font(.system(size: 24, weight: .medium))
                                .tracking(-0.72)
                                .foregroundColor(.black.opacity(0.4))
                        }
                        .opacity(appeared ? 1 : 0)

                        OnboardingTextField(
                            placeholder: "e.g. running, gratitude...",
                            text: $goalText
                        )
                        .onChange(of: goalText) { _, newValue in
                            if newValue != selectedChip { selectedChip = nil }
                        }
                        .opacity(appeared ? 1 : 0)

                        FlowLayout(spacing: 12) {
                            ForEach(suggestions, id: \.self) { suggestion in
                                SuggestionChip(
                                    label: suggestion,
                                    selected: selectedChip == suggestion
                                ) {
                                    selectedChip = suggestion
                                    goalText = suggestion
                                }
                            }
                        }
                        .opacity(appeared ? 1 : 0)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 32)
                }

                PrimaryButton(
                    label: "continue",
                    disabled: goalText.trimmingCharacters(in: .whitespaces).isEmpty
                ) {
                    flowState.goalText = goalText
                    flowState.fetchQuestions(auth: auth)
                    navigateNext = true
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }
        }
        .navigationDestination(isPresented: $navigateNext) {
            GoalBlockersView()
        }
        .onAppear {
            withAnimation(.easeIn(duration: 0.3)) { appeared = true }
        }
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(cream, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("cancel") { onBack() }
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.black.opacity(0.4))
            }
        }
    }
}
