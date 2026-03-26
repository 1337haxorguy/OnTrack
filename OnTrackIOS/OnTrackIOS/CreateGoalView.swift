import SwiftUI

struct CreateGoalView: View {
    var editingGoal: Goal? = nil

    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @Environment(\.dismiss) var dismiss

    @State private var step = 1
    @State private var form: GoalForm

    // Step-specific state
    @State private var titleError = ""
    @State private var validating = false
    @State private var selectedPresetLabel: String? = nil
    @State private var qLoading = false
    @State private var qError = ""
    @State private var saveLoading = false
    @State private var saveError = ""
    @State private var showCustomDates = false
    @State private var showRegenPrompt = false
    @State private var regenLoading = false

    // New restriction/request
    @State private var newRestriction = ""
    @State private var newRequest = ""

    init(editingGoal: Goal? = nil) {
        self.editingGoal = editingGoal
        if let g = editingGoal {
            _form = State(initialValue: GoalForm(from: g))
        } else {
            _form = State(initialValue: GoalForm())
        }
    }

    private var isEditing: Bool { editingGoal != nil }

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                if isEditing {
                    editContent
                } else {
                    wizardContent
                }
            }
            .navigationTitle(isEditing ? "Edit goal" : stepTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var stepTitle: String {
        switch step {
        case 1: return "Your goal"
        case 2: return "Time & schedule"
        default: return "Personalise"
        }
    }

    // MARK: - Wizard

    private var wizardContent: some View {
        VStack(spacing: 0) {
            // Step indicators
            HStack(spacing: 6) {
                ForEach(1...3, id: \.self) { s in
                    Capsule()
                        .fill(s <= step ? Color.indigo : Color.white.opacity(0.12))
                        .frame(height: 3)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 20)

            ScrollView {
                VStack(spacing: 20) {
                    switch step {
                    case 1: stepOne
                    case 2: stepTwo
                    default: stepThree
                    }
                }
                .padding(20)
            }

            // Nav buttons
            HStack(spacing: 12) {
                if step > 1 {
                    Button {
                        withAnimation { step -= 1 }
                    } label: {
                        Text("Back")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .contentShape(Rectangle())
                    }
                    .background(Color.white.opacity(0.06)).foregroundColor(.white).cornerRadius(12)
                }
                Button {
                    Task { await advance() }
                } label: {
                    Text(step == 3 ? "Create goal" : "Continue")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .contentShape(Rectangle())
                }
                .background(canAdvance ? Color.indigo : Color.indigo.opacity(0.4))
                .foregroundColor(.white).cornerRadius(12)
                .disabled(!canAdvance || saveLoading)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
    }

    private var canAdvance: Bool {
        switch step {
        case 1: return !form.title.trimmingCharacters(in: .whitespaces).isEmpty
        default: return true
        }
    }

    // MARK: - Step 1: Title + skill

    private var stepOne: some View {
        VStack(alignment: .leading, spacing: 20) {
            field(label: "What do you want to achieve?") {
                TextField("e.g. Learn fingerstyle guitar, Run a 5K", text: $form.title)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.white.opacity(0.06))
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(titleError.isEmpty ? Color.white.opacity(0.08) : Color.red.opacity(0.5), lineWidth: 1))
                    .foregroundColor(.white)
                    .submitLabel(.done)
                if !titleError.isEmpty {
                    Text(titleError).font(.caption).foregroundColor(.red)
                }
            }

            field(label: "Quick start") {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(templates, id: \.title) { t in
                        Button { form.title = t.title; form.hours_per_week = t.hours } label: {
                            Text(t.title).font(.caption).multilineTextAlignment(.center)
                                .padding(10).frame(maxWidth: .infinity)
                                .background(Color.white.opacity(0.06))
                                .foregroundColor(.gray).cornerRadius(10)
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.08), lineWidth: 1))
                        }
                    }
                }
            }

            field(label: "Your current level") {
                HStack(spacing: 10) {
                    ForEach(Goal.SkillLevel.allCases, id: \.self) { level in
                        Button { form.skill_level = level } label: {
                            VStack(spacing: 4) {
                                Text(level.rawValue.capitalized).font(.subheadline.weight(.medium))
                                Text(skillDesc(level)).font(.caption2).foregroundColor(.gray)
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(form.skill_level == level ? Color.indigo.opacity(0.2) : Color.white.opacity(0.04))
                            .foregroundColor(form.skill_level == level ? .white : .gray)
                            .cornerRadius(10)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(form.skill_level == level ? Color.indigo : Color.white.opacity(0.08), lineWidth: 1))
                        }
                    }
                }
            }
        }
    }

    // MARK: - Step 2: Timeframe + schedule

    private var stepTwo: some View {
        VStack(alignment: .leading, spacing: 20) {
            field(label: "Duration") {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                    ForEach(durationPresets, id: \.label) { preset in
                        let isSelected = selectedPresetLabel == preset.label
                        Button { applyPreset(preset); selectedPresetLabel = preset.label } label: {
                            Text(preset.label).font(.caption.weight(.medium))
                                .frame(maxWidth: .infinity).padding(.vertical, 10)
                                .background(isSelected ? Color.indigo.opacity(0.2) : Color.white.opacity(0.06))
                                .foregroundColor(isSelected ? .white : .gray).cornerRadius(8)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(isSelected ? Color.indigo : Color.white.opacity(0.08), lineWidth: 1))
                        }
                    }
                    let isCustom = selectedPresetLabel == "Custom"
                    Button { showCustomDates = true; selectedPresetLabel = "Custom" } label: {
                        Text("Custom").font(.caption.weight(.medium))
                            .frame(maxWidth: .infinity).padding(.vertical, 10)
                            .background(isCustom ? Color.indigo.opacity(0.2) : Color.white.opacity(0.06))
                            .foregroundColor(isCustom ? .white : .gray).cornerRadius(8)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(isCustom ? Color.indigo : Color.white.opacity(0.08), lineWidth: 1))
                    }
                }
                if showCustomDates || (!form.start_date.isEmpty && !form.end_date.isEmpty) {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Start").font(.caption).foregroundColor(.gray)
                            TextField("yyyy-mm-dd", text: $form.start_date)
                                .font(.caption).padding(8)
                                .background(Color.white.opacity(0.06)).cornerRadius(8)
                                .foregroundColor(.white)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("End").font(.caption).foregroundColor(.gray)
                            TextField("yyyy-mm-dd or blank", text: $form.end_date)
                                .font(.caption).padding(8)
                                .background(Color.white.opacity(0.06)).cornerRadius(8)
                                .foregroundColor(.white)
                        }
                    }
                }
            }

            field(label: "Hours per week") {
                HStack {
                    Slider(value: $form.hours_per_week, in: 1...20, step: 0.5)
                        .tint(.indigo)
                    Text("\(formatHours(form.hours_per_week)) hrs")
                        .font(.subheadline).foregroundColor(.white).frame(width: 55, alignment: .trailing)
                }
            }

            field(label: "Preferred days") {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 6) {
                    ForEach(ALL_DAYS, id: \.self) { day in
                        let active = form.selected_days.contains(day)
                        Button { toggleDay(day) } label: {
                            Text(String(day.prefix(1)).uppercased())
                                .font(.caption2.weight(.semibold))
                                .frame(maxWidth: .infinity).aspectRatio(1, contentMode: .fit)
                                .background(active ? Color.indigo : Color.white.opacity(0.06))
                                .foregroundColor(active ? .white : .gray).cornerRadius(8)
                        }
                    }
                }
            }

            field(label: "Daily time limit") {
                Toggle("", isOn: $form.has_daily_limit).labelsHidden().tint(.indigo)
                if form.has_daily_limit {
                    Stepper("\(form.daily_limit_minutes) min/day", value: $form.daily_limit_minutes, in: 15...480, step: 15)
                        .font(.subheadline).foregroundColor(.white)
                }
            }
        }
    }

    // MARK: - Step 3: Questions + context

    private var stepThree: some View {
        VStack(alignment: .leading, spacing: 20) {
            if qLoading {
                HStack { ProgressView().tint(.indigo); Text("Generating questions…").font(.caption).foregroundColor(.gray) }
            }
            if !qError.isEmpty {
                Text(qError).font(.caption).foregroundColor(.red)
            }

            ForEach(Array(form.followup_questions.enumerated()), id: \.offset) { i, q in
                questionCard(index: i, question: q)
            }

            // Restrictions
            field(label: "Restrictions or limitations") {
                VStack(alignment: .leading, spacing: 8) {
                    FlowLayout(spacing: 6) {
                        ForEach(Array(form.restrictions.enumerated()), id: \.offset) { i, r in
                            tagChip(r) { form.restrictions.remove(at: i) }
                        }
                    }
                    HStack {
                        TextField("e.g. Bad knee, no equipment", text: $newRestriction)
                            .font(.caption).padding(8)
                            .background(Color.white.opacity(0.06)).cornerRadius(8).foregroundColor(.white)
                        Button("Add") {
                            if !newRestriction.isEmpty { form.restrictions.append(newRestriction); newRestriction = "" }
                        }.font(.caption).foregroundColor(.indigo).disabled(newRestriction.isEmpty)
                    }
                }
            }

            // Additional context
            field(label: "Additional context") {
                TextEditor(text: $form.additional_context)
                    .font(.subheadline).foregroundColor(.white).frame(minHeight: 80)
                    .padding(10).background(Color.white.opacity(0.06)).cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.08), lineWidth: 1))
                    .scrollContentBackground(.hidden)
            }
        }
    }

    @ViewBuilder
    private func questionCard(index i: Int, question q: FollowupQuestion) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(q.question).font(.subheadline).foregroundColor(.white)

            switch q.type {
            case .boolean:
                HStack(spacing: 10) {
                    ForEach(["Yes", "No"], id: \.self) { opt in
                        pillButton(opt, selected: form.followup_questions[i].user_response == opt) {
                            form.followup_questions[i].user_response = opt
                        }
                    }
                }
            case .multiple_choice:
                FlowLayout(spacing: 6) {
                    ForEach(q.options ?? [], id: \.self) { opt in
                        pillButton(opt, selected: form.followup_questions[i].user_response == opt) {
                            form.followup_questions[i].user_response = opt
                        }
                    }
                }
            case .multi_select:
                FlowLayout(spacing: 6) {
                    ForEach(q.options ?? [], id: \.self) { opt in
                        let selected = form.followup_questions[i].user_response.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.contains(opt)
                        pillButton(opt, selected: selected, checkmark: true) {
                            var parts = form.followup_questions[i].user_response.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                            if selected { parts.removeAll { $0 == opt } } else { parts.append(opt) }
                            form.followup_questions[i].user_response = parts.joined(separator: ", ")
                        }
                    }
                }
            case .scale:
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        ForEach(1...5, id: \.self) { n in
                            Button { form.followup_questions[i].user_response = "\(n)" } label: {
                                Text("\(n)").font(.subheadline.weight(.semibold))
                                    .frame(width: 40, height: 40)
                                    .background(form.followup_questions[i].user_response == "\(n)" ? Color.indigo : Color.white.opacity(0.06))
                                    .foregroundColor(form.followup_questions[i].user_response == "\(n)" ? .white : .gray)
                                    .cornerRadius(10)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(
                                        form.followup_questions[i].user_response == "\(n)" ? Color.indigo : Color.white.opacity(0.08), lineWidth: 1))
                            }
                        }
                    }
                    HStack {
                        Text("Not at all").font(.caption2).foregroundColor(.gray)
                        Spacer()
                        Text("Very much").font(.caption2).foregroundColor(.gray)
                    }
                }
            default:
                TextField("Your answer", text: $form.followup_questions[i].user_response)
                    .font(.subheadline).padding(10)
                    .background(Color.white.opacity(0.06)).cornerRadius(10).foregroundColor(.white)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.08), lineWidth: 1))
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
        .cornerRadius(14)
    }

    // MARK: - Edit mode

    private var editContent: some View {
        ScrollView {
            VStack(spacing: 20) {
                if showRegenPrompt {
                    regenPromptCard
                } else {
                    // Full form
                    stepOne
                    stepTwo
                    stepThree

                    if !saveError.isEmpty {
                        Text(saveError).font(.caption).foregroundColor(.red)
                    }

                    Button { Task { await saveEdits() } } label: {
                        HStack {
                            if saveLoading { ProgressView().tint(.white).scaleEffect(0.8) }
                            Text(saveLoading ? "Checking…" : "Save changes").font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(form.title.isEmpty ? Color.indigo.opacity(0.4) : Color.indigo)
                        .foregroundColor(.white).cornerRadius(12)
                    }
                    .disabled(form.title.isEmpty || saveLoading)

                    // Delete
                    Button { deleteGoal() } label: {
                        Text("Delete goal").font(.subheadline)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(Color.red.opacity(0.12)).foregroundColor(.red).cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.red.opacity(0.25), lineWidth: 1))
                    }
                }
            }
            .padding(20)
        }
    }

    private var regenPromptCard: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Goal saved!").font(.headline).foregroundColor(.white)
                Text("Would you like to regenerate the plan blocks for \"\(form.title)\"? Other goals won't be affected.")
                    .font(.subheadline).foregroundColor(.gray)
            }
            HStack(spacing: 12) {
                Button { Task { await regenSavedGoal() } } label: {
                    HStack {
                        if regenLoading { ProgressView().tint(.white).scaleEffect(0.8) }
                        Text(regenLoading ? "Regenerating…" : "Regenerate").font(.subheadline.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Color.indigo).foregroundColor(.white).cornerRadius(12)
                }
                .disabled(regenLoading)

                Button { dismiss() } label: {
                    Text("Not now").font(.subheadline)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.white.opacity(0.06)).foregroundColor(.gray).cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.08), lineWidth: 1))
                }
                .disabled(regenLoading)
            }
        }
        .padding(16)
        .background(Color.indigo.opacity(0.08))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.indigo.opacity(0.3), lineWidth: 1))
        .cornerRadius(14)
    }

    // MARK: - Actions

    private func advance() async {
        if step == 1 {
            withAnimation { step = 2 }

        } else if step == 2 {
            withAnimation { step = 3 }
            if form.followup_questions.isEmpty {
                await fetchQuestions()
            }

        } else {
            // Save new goal
            await createGoal()
        }
    }

    private func fetchQuestions() async {
        qLoading = true; qError = ""
        do {
            let token = await auth.getToken()
            form.followup_questions = try await APIService.fetchFollowupQuestions(
                title: form.title, skillLevel: form.skill_level.rawValue,
                restrictions: form.restrictions, requests: form.requests,
                context: form.additional_context, token: token
            )
        } catch { print("fetchQuestions error:", error); qError = "Couldn't load questions." }
        qLoading = false
    }

    private func createGoal() async {
        saveLoading = true
        let goal = form.toGoal(id: UUID().uuidString)
        appState.goals.append(goal)
        if let token = await auth.getToken() { appState.queueSync(token: token) }
        saveLoading = false
        dismiss()
    }

    private func saveEdits() async {
        guard let existing = editingGoal else { return }
        saveLoading = true; saveError = ""
        do {
            let result = try await APIService.validateGoal(title: form.title)
            if !result.valid { saveError = result.reason.isEmpty ? "Invalid goal." : result.reason; saveLoading = false; return }
        } catch {}
        let updated = form.toGoal(id: existing.id)
        appState.goals = appState.goals.map { $0.id == existing.id ? updated : $0 }
        if let token = await auth.getToken() { appState.queueSync(token: token) }
        saveLoading = false
        showRegenPrompt = true
    }

    private func regenSavedGoal() async {
        guard let existing = editingGoal else { return }
        regenLoading = true
        let goal = form.toGoal(id: existing.id)
        do {
            let token = await auth.getToken()
            let newDays = try await APIService.regenerateGoal(goal: goal, schedule: appState.schedule, token: token)
            appState.plan = mergeGoalPlan(existing: appState.plan ?? [], newDays: newDays, goalId: existing.id)
            if let token { appState.queueSync(token: token) }
            appState.showToast("\"\(goal.title)\" blocks updated!", actionLabel: "View calendar →", actionRoute: .calendar)
            dismiss()
        } catch {
            appState.showToast("Failed to regenerate. Try again from Goals.")
        }
        regenLoading = false
    }

    private func deleteGoal() {
        guard let existing = editingGoal else { return }
        appState.goals.removeAll { $0.id == existing.id }
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
        dismiss()
    }

    private func toggleDay(_ day: String) {
        if form.selected_days.contains(day) { form.selected_days.removeAll { $0 == day } }
        else { form.selected_days.append(day) }
    }

    private func applyPreset(_ preset: DurationPreset) {
        let today = Date()
        let cal = Calendar.current
        form.start_date = isoDate(today)
        if let days = preset.days, let end = cal.date(byAdding: .day, value: days, to: today) {
            form.end_date = isoDate(end)
        } else {
            form.end_date = ""
        }
    }

    // MARK: - UI helpers

    @ViewBuilder
    private func field<C: View>(label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.caption.weight(.medium)).foregroundColor(.gray)
            content()
        }
    }

    private func pillButton(_ label: String, selected: Bool, checkmark: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if checkmark && selected { Image(systemName: "checkmark").font(.caption2.weight(.bold)) }
                Text(label).font(.caption)
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(selected ? Color.indigo.opacity(0.25) : Color.white.opacity(0.06))
            .foregroundColor(selected ? .indigo : .gray)
            .cornerRadius(20)
            .overlay(Capsule().stroke(selected ? Color.indigo.opacity(0.5) : Color.white.opacity(0.08), lineWidth: 1))
        }
    }

    private func tagChip(_ text: String, onRemove: @escaping () -> Void) -> some View {
        HStack(spacing: 4) {
            Text(text).font(.caption2).foregroundColor(.white)
            Button(action: onRemove) { Image(systemName: "xmark").font(.system(size: 8, weight: .bold)).foregroundColor(.gray) }
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(Color.white.opacity(0.07)).cornerRadius(6)
    }

    // MARK: - Static data

    private let templates: [(title: String, hours: Double)] = [
        ("Learn guitar", 4), ("Run a 5K", 3), ("Learn Spanish", 5),
        ("Build a morning routine", 2), ("Learn to cook", 3),
        ("Get stronger at the gym", 4), ("Learn to draw", 3), ("Start meditating", 2)
    ]

    private struct DurationPreset { let label: String; let days: Int? }
    private let durationPresets: [DurationPreset] = [
        .init(label: "2 weeks", days: 14), .init(label: "1 month", days: 30),
        .init(label: "3 months", days: 90), .init(label: "6 months", days: 180),
        .init(label: "1 year", days: 365), .init(label: "No end date", days: nil),
    ]

    private func skillDesc(_ l: Goal.SkillLevel) -> String {
        switch l { case .beginner: return "Just starting"; case .intermediate: return "Some experience"; case .advanced: return "Well practised" }
    }

    private func isoDate(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: d)
    }

    private func formatHours(_ h: Double) -> String {
        h == h.rounded() ? String(Int(h)) : String(format: "%.1f", h)
    }
}

// MARK: - GoalForm helper

struct GoalForm {
    var title = ""
    var skill_level: Goal.SkillLevel = .beginner
    var start_date = ""
    var end_date = ""
    var hours_per_week: Double = 4
    var has_daily_limit = false
    var daily_limit_minutes = 60
    var selected_days: [String] = ALL_DAYS
    var restrictions: [String] = []
    var requests: [String] = []
    var additional_context = ""
    var followup_questions: [FollowupQuestion] = []

    init() {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let today = Date()
        start_date = f.string(from: today)
        end_date = f.string(from: Calendar.current.date(byAdding: .day, value: 30, to: today)!)
    }

    init(from goal: Goal) {
        title = goal.title
        skill_level = goal.skill_level
        start_date = goal.timeframe.start_date
        end_date = goal.timeframe.end_date
        hours_per_week = goal.hours_per_week
        has_daily_limit = goal.has_daily_limit
        daily_limit_minutes = goal.daily_limit_minutes
        selected_days = goal.selected_days
        restrictions = goal.restrictions
        requests = goal.requests
        additional_context = goal.additional_context
        followup_questions = goal.followup_questions
    }

    func toGoal(id: String) -> Goal {
        Goal(
            id: id, title: title, skill_level: skill_level,
            timeframe: Timeframe(start_date: start_date, end_date: end_date),
            restrictions: restrictions, requests: requests,
            additional_context: additional_context,
            followup_questions: followup_questions,
            hours_per_week: hours_per_week,
            has_daily_limit: has_daily_limit,
            daily_limit_minutes: daily_limit_minutes,
            selected_days: selected_days
        )
    }
}
