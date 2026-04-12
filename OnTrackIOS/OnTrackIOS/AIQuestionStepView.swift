import SwiftUI

struct AIQuestionStepView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var flowState: OnboardingFlowState

    let index: Int

    @State private var appeared = false
    @State private var navigateNext = false

    private let cream = Color(red: 249/255, green: 249/255, blue: 249/255)

    private var question: FollowupQuestion { flowState.questions[index] }

    private var answer: String {
        index < flowState.answers.count ? flowState.answers[index] : ""
    }
    private func setAnswer(_ value: String) {
        guard index < flowState.answers.count else { return }
        flowState.answers[index] = value
    }

    // Comma-separated multi-select answer set
    private var selectedSet: Set<String> {
        Set(answer.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty })
    }
    private func toggleOption(_ option: String) {
        var set = selectedSet
        if set.contains(option) { set.remove(option) } else { set.insert(option) }
        setAnswer(set.joined(separator: ", "))
    }

    private var options: [String] {
        switch question.type {
        case .boolean: return ["Yes", "No"]
        default: return question.options ?? []
        }
    }

    private var totalSteps: Int { 9 }
    private var stepNumber: Int { index + 4 }

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                StepProgressBar(steps: totalSteps, current: stepNumber)
                    .padding(.horizontal, 24)
                    .padding(.top, 32)
                    .padding(.bottom, 40)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 40) {
                        VStack(alignment: .leading, spacing: 14) {
                            if let emoji = question.emoji {
                                Text(emoji)
                                    .font(.system(size: 52))
                                    .opacity(appeared ? 1 : 0)
                            }
                            Text(question.question)
                                .font(.system(size: 32, weight: .semibold))
                                .tracking(-0.96)
                                .foregroundColor(.black)
                                .opacity(appeared ? 1 : 0)
                        }

                        switch question.type {
                        case .scale:
                            scaleInput
                                .opacity(appeared ? 1 : 0)
                        case .boolean:
                            singleChoiceList(options: ["Yes", "No"])
                                .opacity(appeared ? 1 : 0)
                        case .multiple_choice, .multi_select:
                            choiceList(options: question.options ?? [])
                                .opacity(appeared ? 1 : 0)
                        default:
                            OnboardingTextField(
                                placeholder: "e.g. share your answer here...",
                                text: Binding(get: { answer }, set: { setAnswer($0) })
                            )
                            .opacity(appeared ? 1 : 0)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 32)
                }

                VStack(spacing: 12) {
                    let isLast = index + 1 >= flowState.questions.count
                    PrimaryButton(label: isLast ? "make my plan" : "continue") {
                        navigateNext = true
                    }

                    if !isLast {
                        Button("skip") {
                            navigateNext = true
                        }
                        .font(.system(size: 20))
                        .tracking(-0.6)
                        .foregroundColor(Color(red: 179/255, green: 179/255, blue: 179/255))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 48)
            }
        }
        .navigationDestination(isPresented: $navigateNext) {
            if index + 1 < flowState.questions.count {
                AIQuestionStepView(index: index + 1)
            } else {
                GeneratingView()
            }
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

    // MARK: - Scale 1–5

    private var scaleInput: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ForEach(1...5, id: \.self) { n in
                    let label = "\(n)"
                    let isSelected = answer == label
                    Button {
                        setAnswer(isSelected ? "" : label)
                    } label: {
                        ZStack {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(isSelected
                                      ? Color.black
                                      : Color(red: 241/255, green: 241/255, blue: 241/255))
                            Text(label)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(isSelected ? .white : Color(red: 117/255, green: 117/255, blue: 117/255))
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                    }
                    .buttonStyle(.plain)
                    .animation(.easeInOut(duration: 0.15), value: isSelected)
                }
            }
            HStack {
                Text("not at all")
                    .font(.system(size: 12))
                    .foregroundColor(Color(red: 179/255, green: 179/255, blue: 179/255))
                Spacer()
                Text("very much")
                    .font(.system(size: 12))
                    .foregroundColor(Color(red: 179/255, green: 179/255, blue: 179/255))
            }
        }
    }

    // MARK: - Single-select choice list (boolean / multiple_choice)

    @ViewBuilder
    private func singleChoiceList(options: [String]) -> some View {
        VStack(spacing: 20) {
            ForEach(options, id: \.self) { option in
                MultipleChoiceRow(
                    label: option,
                    selected: answer == option
                ) {
                    setAnswer(option)
                }
            }
        }
    }

    // MARK: - Multi-select choice list

    @ViewBuilder
    private func choiceList(options: [String]) -> some View {
        VStack(spacing: 20) {
            ForEach(options, id: \.self) { option in
                MultipleChoiceRow(
                    label: option,
                    selected: selectedSet.contains(option)
                ) {
                    toggleOption(option)
                }
            }
        }
    }
}
