import SwiftUI

struct GoalScheduleView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var flowState: OnboardingFlowState

    @State private var selected: Set<String> = []
    @State private var otherText: String = ""
    @State private var appeared = false
    @State private var navigateNext = false

    private let cream = Color(red: 249/255, green: 249/255, blue: 249/255)

    private let options = [
        "💼 9-5 job",
        "📋 part-time job",
        "🎓 college/school",
        "other:"
    ]

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                StepProgressBar(steps: 6, current: 3)
                    .padding(.horizontal, 24)
                    .padding(.top, 32)
                    .padding(.bottom, 40)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 40) {
                        VStack(alignment: .leading, spacing: 20) {
                            Text("now, let's figure out your schedule.")
                                .font(.system(size: 24, weight: .medium))
                                .tracking(-0.72)
                                .foregroundColor(.black.opacity(0.4))

                            Text("do you have a regular time commitment?")
                                .font(.system(size: 32, weight: .semibold))
                                .tracking(-0.96)
                                .foregroundColor(.black)
                        }
                        .opacity(appeared ? 1 : 0)

                        VStack(spacing: 20) {
                            ForEach(options, id: \.self) { option in
                                MultipleChoiceRow(
                                    label: option,
                                    selected: selected.contains(option)
                                ) {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        if selected.contains(option) {
                                            selected.remove(option)
                                        } else {
                                            selected.insert(option)
                                        }
                                    }
                                }
                            }

                            if selected.contains("other:") {
                                OnboardingTextField(
                                    placeholder: "e.g. freelancing, caregiving...",
                                    text: $otherText
                                )
                                .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                        }
                        .opacity(appeared ? 1 : 0)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 32)
                }

                VStack(spacing: 12) {
                    PrimaryButton(
                        label: flowState.isLoading ? "loading..." : "continue",
                        loading: flowState.isLoading
                    ) {
                        navigateNext = true
                    }

                    Button("skip") {
                        navigateNext = true
                    }
                    .font(.system(size: 20))
                    .tracking(-0.6)
                    .foregroundColor(Color(red: 179/255, green: 179/255, blue: 179/255))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }
        }
        .navigationDestination(isPresented: $navigateNext) {
            AIQuestionStepView(index: 0)
        }
        .onAppear {
            withAnimation(.easeIn(duration: 0.3)) { appeared = true }
        }
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(cream, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.black.opacity(0.4))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
