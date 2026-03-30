import SwiftUI

struct ScheduleView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    @State private var showAddRecurring = false
    @State private var showAddSpecific = false
    @State private var showTimezonePicker = false
    @State private var showLogoutConfirm = false

    private let days = ALL_DAYS

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 20) {
                        timezoneCard
                        freeSlotsCard
                        recurringBlocksCard
                        specificBlocksCard
                        logoutButton
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showAddRecurring) { AddRecurringBlockView() }
            .sheet(isPresented: $showAddSpecific) { AddSpecificBlockView() }
            .sheet(isPresented: $showTimezonePicker) {
                TimezonePickerView(selected: appState.schedule.timezone) { tz in
                    appState.schedule.timezone = tz
                    Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
                }
            }
            .confirmationDialog("Sign out of OnTrack?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    Task { await auth.logout() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var logoutButton: some View {
        Button {
            showLogoutConfirm = true
        } label: {
            HStack {
                Spacer()
                Text("Sign Out")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.red)
                Spacer()
            }
            .padding(14)
            .background(Color.white.opacity(0.04))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.red.opacity(0.3), lineWidth: 1))
            .cornerRadius(14)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Timezone

    private var timezoneCard: some View {
        sectionCard(title: "Timezone") {
            Button { showTimezonePicker = true } label: {
                HStack {
                    Image(systemName: "globe").foregroundColor(.gray)
                    Text(appState.schedule.timezone).font(.subheadline).foregroundColor(.white)
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption2).foregroundColor(.gray)
                }
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Free slots

    private var freeSlotsCard: some View {
        sectionCard(title: "Available time") {
            VStack(spacing: 12) {
                ForEach(days, id: \.self) { day in
                    FreeDayRow(day: day)
                }
            }
        }
    }

    // MARK: - Recurring blocks

    private var recurringBlocksCard: some View {
        sectionCard(title: "Recurring commitments", action: { showAddRecurring = true }, actionLabel: "+ Add") {
            if appState.schedule.recurring_blocks.isEmpty {
                Text("No recurring blocks").font(.caption).foregroundColor(.gray)
            } else {
                ForEach(appState.schedule.recurring_blocks) { block in
                    RecurringBlockRow(block: block)
                }
            }
        }
    }

    // MARK: - Specific blocks

    private var specificBlocksCard: some View {
        sectionCard(title: "Specific dates blocked", action: { showAddSpecific = true }, actionLabel: "+ Add") {
            if appState.schedule.specific_blocks.isEmpty {
                Text("No specific blocks").font(.caption).foregroundColor(.gray)
            } else {
                ForEach(appState.schedule.specific_blocks) { block in
                    SpecificBlockRow(block: block)
                }
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func sectionCard<Content: View>(title: String, action: (() -> Void)? = nil, actionLabel: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(.subheadline.weight(.semibold)).foregroundColor(.white)
                Spacer()
                if let action, let label = actionLabel {
                    Button(label, action: action).font(.caption).foregroundColor(.indigo)
                }
            }
            content()
        }
        .padding(14)
        .background(Color.white.opacity(0.04))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
        .cornerRadius(14)
    }
}

// MARK: - Free day row

struct FreeDayRow: View {
    let day: String
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @State private var showAdd = false

    private var slots: [TimeSlot] { appState.schedule.free_slots[day] ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(day.capitalized).font(.caption.weight(.medium)).foregroundColor(.gray)
                Spacer()
                Button { showAdd = true } label: {
                    Image(systemName: "plus.circle").font(.caption).foregroundColor(.indigo)
                }
            }
            if slots.isEmpty {
                Text("No slots — treated as open all day").font(.caption2).foregroundColor(Color(white: 0.35))
            } else {
                FlowLayout(spacing: 6) {
                    ForEach(Array(slots.enumerated()), id: \.offset) { i, slot in
                        HStack(spacing: 4) {
                            Text("\(slot.start) – \(slot.end)").font(.caption2).foregroundColor(.white)
                            Button { removeSlot(at: i) } label: {
                                Image(systemName: "xmark").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                            }
                        }
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.white.opacity(0.07))
                        .cornerRadius(6)
                    }
                }
            }
        }
        .sheet(isPresented: $showAdd) { AddSlotView(day: day) }
    }

    private func removeSlot(at index: Int) {
        appState.schedule.free_slots[day]?.remove(at: index)
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }
}

// MARK: - Recurring block row

struct RecurringBlockRow: View {
    let block: RecurringBlock
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(block.label).font(.subheadline).foregroundColor(.white)
                Text(block.days.map { String($0.prefix(3)).capitalized }.joined(separator: ", ") + " · \(block.start_time)–\(block.end_time)")
                    .font(.caption).foregroundColor(.gray)
            }
            Spacer()
            Button { delete() } label: {
                Image(systemName: "trash").font(.caption).foregroundColor(.red.opacity(0.7))
            }
        }
        .padding(10)
        .background(Color.white.opacity(0.03))
        .cornerRadius(10)
    }

    private func delete() {
        appState.schedule.recurring_blocks.removeAll { $0.id == block.id }
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }
}

// MARK: - Specific block row

struct SpecificBlockRow: View {
    let block: SpecificBlock
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(block.label).font(.subheadline).foregroundColor(.white)
                Text(block.all_day ? "\(block.date) · All day" : "\(block.date) · \(block.start_time)–\(block.end_time)")
                    .font(.caption).foregroundColor(.gray)
            }
            Spacer()
            Button { delete() } label: {
                Image(systemName: "trash").font(.caption).foregroundColor(.red.opacity(0.7))
            }
        }
        .padding(10)
        .background(Color.white.opacity(0.03))
        .cornerRadius(10)
    }

    private func delete() {
        appState.schedule.specific_blocks.removeAll { $0.id == block.id }
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
    }
}

// MARK: - Add slot sheet

struct AddSlotView: View {
    let day: String
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @Environment(\.dismiss) var dismiss

    @State private var start = Date()
    @State private var end = Date()

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                Form {
                    DatePicker("Start", selection: $start, displayedComponents: .hourAndMinute)
                    DatePicker("End", selection: $end, displayedComponents: .hourAndMinute)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Add slot — \(day.capitalized)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Add") { save() } }
            }
        }
    }

    private func save() {
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        let slot = TimeSlot(start: f.string(from: start), end: f.string(from: end))
        appState.schedule.free_slots[day, default: []].append(slot)
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
        dismiss()
    }
}

// MARK: - Add recurring block sheet

struct AddRecurringBlockView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @Environment(\.dismiss) var dismiss

    @State private var label = ""
    @State private var selectedDays: Set<String> = []
    @State private var start = Date()
    @State private var end = Date()

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                Form {
                    Section("Label") {
                        TextField("e.g. Work, Gym class", text: $label)
                    }
                    Section("Days") {
                        ForEach(ALL_DAYS, id: \.self) { day in
                            Button {
                                if selectedDays.contains(day) { selectedDays.remove(day) }
                                else { selectedDays.insert(day) }
                            } label: {
                                HStack {
                                    Text(day.capitalized)
                                    Spacer()
                                    if selectedDays.contains(day) {
                                        Image(systemName: "checkmark").foregroundColor(.indigo)
                                    }
                                }
                            }
                            .foregroundColor(.white)
                        }
                    }
                    Section("Time") {
                        DatePicker("Start", selection: $start, displayedComponents: .hourAndMinute)
                        DatePicker("End", selection: $end, displayedComponents: .hourAndMinute)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Add recurring block")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }.disabled(label.isEmpty || selectedDays.isEmpty)
                }
            }
        }
    }

    private func save() {
        let f = DateFormatter(); f.dateFormat = "HH:mm"
        let block = RecurringBlock(
            id: UUID().uuidString, label: label,
            days: Array(selectedDays), start_time: f.string(from: start), end_time: f.string(from: end)
        )
        appState.schedule.recurring_blocks.append(block)
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
        dismiss()
    }
}

// MARK: - Add specific block sheet

struct AddSpecificBlockView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var auth: AuthManager
    @Environment(\.dismiss) var dismiss

    @State private var label = ""
    @State private var date = Date()
    @State private var allDay = false
    @State private var start = Date()
    @State private var end = Date()

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                Form {
                    Section("Label") { TextField("e.g. Doctor appointment", text: $label) }
                    Section("Date") { DatePicker("Date", selection: $date, displayedComponents: .date) }
                    Section("Time") {
                        Toggle("All day", isOn: $allDay)
                        if !allDay {
                            DatePicker("Start", selection: $start, displayedComponents: .hourAndMinute)
                            DatePicker("End", selection: $end, displayedComponents: .hourAndMinute)
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Block a date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }.disabled(label.isEmpty)
                }
            }
        }
    }

    private func save() {
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
        let tf = DateFormatter(); tf.dateFormat = "HH:mm"
        let block = SpecificBlock(
            id: UUID().uuidString, label: label,
            date: df.string(from: date), all_day: allDay,
            start_time: allDay ? "00:00" : tf.string(from: start),
            end_time: allDay ? "23:59" : tf.string(from: end)
        )
        appState.schedule.specific_blocks.append(block)
        Task { if let token = await auth.getToken() { appState.queueSync(token: token) } }
        dismiss()
    }
}

// MARK: - Timezone picker

struct TimezonePickerView: View {
    let selected: String
    let onSelect: (String) -> Void

    @State private var search = ""
    @Environment(\.dismiss) var dismiss

    private var filtered: [String] {
        let all = TimeZone.knownTimeZoneIdentifiers
        return search.isEmpty ? all : all.filter { $0.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        NavigationStack {
            ZStack { Color.black.ignoresSafeArea()
                List {
                    ForEach(filtered, id: \.self) { tz in
                        Button {
                            onSelect(tz)
                            dismiss()
                        } label: {
                            HStack {
                                Text(tz).font(.subheadline).foregroundColor(.white)
                                Spacer()
                                if tz == selected {
                                    Image(systemName: "checkmark").foregroundColor(.indigo)
                                }
                            }
                        }
                        .listRowBackground(Color.white.opacity(0.04))
                    }
                }
                .listStyle(.plain)
                .searchable(text: $search, prompt: "Search timezones")
            }
            .navigationTitle("Timezone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

// MARK: - Simple flow layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 300
        var x: CGFloat = 0; var y: CGFloat = 0; var rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > width { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: width, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX; var y = bounds.minY; var rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}
