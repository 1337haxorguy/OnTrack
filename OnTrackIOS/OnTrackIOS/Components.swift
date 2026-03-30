import SwiftUI

// MARK: - Step Progress Bar
// Segmented progress indicator used across onboarding steps.
// `steps` = total number of segments, `current` = how many are filled (1-indexed).

struct StepProgressBar: View {
    let steps: Int
    let current: Int

    var body: some View {
        HStack(spacing: 4) {
            ForEach(1...steps, id: \.self) { i in
                Capsule()
                    .fill(i <= current
                          ? Color(red: 44/255, green: 44/255, blue: 44/255)
                          : Color(red: 242/255, green: 242/255, blue: 242/255))
                    .frame(height: 5)
            }
        }
    }
}

// MARK: - Suggestion Chip
// Default (Variant1): white bg, grey border, black text.
// Selected (Variant2): black bg, no border, white text.

struct SuggestionChip: View {
    let label: String
    var selected: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .tracking(-0.42)
                .foregroundColor(selected ? .white : .black)
                .padding(.horizontal, 20)
                .frame(height: 46)
                .background(selected ? Color.black : Color.white)
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color(red: 220/255, green: 220/255, blue: 220/255), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.15), value: selected)
    }
}

// MARK: - Primary Button (light theme)
// Black pill CTA used on landing and onboarding screens.

struct PrimaryButton: View {
    let label: String
    var loading: Bool = false
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                if loading {
                    ProgressView().tint(.white)
                } else {
                    Text(label)
                        .font(.system(size: 22, weight: .semibold))
                        .tracking(-0.66)
                }
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.black.opacity(loading || disabled ? 0.4 : 1))
            .cornerRadius(100)
        }
        .disabled(loading || disabled)
    }
}

// MARK: - Multiple Choice Row
// Grey pill row with label on left and radio circle on right.
// Selected: filled black circle.

struct MultipleChoiceRow: View {
    let label: String
    var selected: Bool = false
    let action: () -> Void

    @State private var scale: CGFloat = 1

    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) {
                scale = 0.97
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) {
                    scale = 1
                }
            }
            action()
        }) {
            HStack {
                Text(label)
                    .font(.system(size: 16, weight: .medium))
                    .tracking(-0.48)
                    .foregroundColor(selected ? .black : Color(red: 117/255, green: 117/255, blue: 117/255))
                Spacer()
                ZStack {
                    Circle()
                        .stroke(selected ? Color.black : Color(red: 178/255, green: 178/255, blue: 178/255), lineWidth: 1)
                        .frame(width: 20, height: 20)
                    if selected {
                        Circle()
                            .fill(Color.black)
                            .frame(width: 20, height: 20)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(selected
                ? Color(red: 230/255, green: 230/255, blue: 230/255)
                : Color(red: 241/255, green: 241/255, blue: 241/255))
            .cornerRadius(16)
        }
        .buttonStyle(.plain)
        .scaleEffect(scale)
        .animation(.easeInOut(duration: 0.15), value: selected)
    }
}

// MARK: - Onboarding Text Field
// Light-theme rounded input used in the goal creation flow.

struct OnboardingTextField: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        TextField(
            "",
            text: $text,
            prompt: Text(placeholder)
                .foregroundColor(Color(red: 179/255, green: 179/255, blue: 179/255))
        )
        .font(.system(size: 20))
        .tracking(-0.6)
        .foregroundColor(.black)
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(Color(red: 241/255, green: 241/255, blue: 241/255))
        .cornerRadius(16)
    }
}

// MARK: - Regen Sheet
// Dark half-sheet with optional feedback input for regenerating days/blocks/tasks.

struct RegenSheet: View {
    let title: String
    @Binding var feedback: String
    let isLoading: Bool
    let error: String
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 20) {
                    Text("Optionally describe what to change.")
                        .font(.subheadline).foregroundColor(.gray)

                    TextField("e.g. Make it harder, add a warmup...", text: $feedback, axis: .vertical)
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .lineLimit(3...6)
                        .padding(12)
                        .background(Color.white.opacity(0.06))
                        .cornerRadius(10)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.08), lineWidth: 1))

                    if !error.isEmpty {
                        Text(error).font(.caption).foregroundColor(.red)
                    }

                    Button {
                        onConfirm()
                    } label: {
                        HStack(spacing: 8) {
                            if isLoading { ProgressView().tint(.white).scaleEffect(0.8) }
                            Text(isLoading ? "Regenerating…" : "Regenerate")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(isLoading ? Color.indigo.opacity(0.5) : Color.indigo)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(isLoading)

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onCancel() }.disabled(isLoading)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Edit Task Sheet
// Dark sheet for editing a task's title, description, and estimated minutes.

struct EditTaskSheet: View {
    @Binding var task: PlanTask
    let onSave: () -> Void
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                Form {
                    Section {
                        TextField("Task title", text: $task.title)
                            .foregroundColor(.white)
                    } header: { Text("Title") }

                    Section {
                        TextEditor(text: $task.description)
                            .foregroundColor(.white)
                            .frame(minHeight: 80)
                            .scrollContentBackground(.hidden)
                    } header: { Text("Description") }

                    Section {
                        Stepper("\(task.estimated_minutes) min", value: $task.estimated_minutes, in: 5...240, step: 5)
                            .foregroundColor(.white)
                    } header: { Text("Estimated time") }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Edit task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { onSave() } }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
