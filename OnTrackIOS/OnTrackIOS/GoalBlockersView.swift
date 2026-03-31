import SwiftUI

struct GoalBlockersView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var flowState: OnboardingFlowState

    @State private var selected: Set<String> = []
    @State private var appeared = false
    @State private var navigateNext = false

    private let cream = Color(red: 249/255, green: 249/255, blue: 249/255)

    private let options = [
        "🕗 No time",
        "🤷🏻 Don't know where to start",
        "😔 Keep losing motivation",
        "👻 Fear of starting",
        "🚨 Too distracted"
    ]

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                StepProgressBar(steps: 8, current: 2)
                    .padding(.horizontal, 24)
                    .padding(.top, 32)
                    .padding(.bottom, 40)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 40) {
                        Text("what's been stopping you?")
                            .font(.system(size: 32, weight: .semibold))
                            .tracking(-0.96)
                            .foregroundColor(.black)
                            .opacity(appeared ? 1 : 0)

                        VStack(spacing: 20) {
                            ForEach(options, id: \.self) { option in
                                MultipleChoiceRow(
                                    label: option,
                                    selected: selected.contains(option)
                                ) {
                                    if selected.contains(option) {
                                        selected.remove(option)
                                    } else {
                                        selected.insert(option)
                                    }
                                }
                            }
                        }
                        .opacity(appeared ? 1 : 0)
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 32)
                }

                VStack(spacing: 12) {
                    PrimaryButton(label: "continue") {
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
            GoalScheduleView()
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
