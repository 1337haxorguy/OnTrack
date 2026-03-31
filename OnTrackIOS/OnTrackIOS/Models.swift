import Foundation

// MARK: - Goal

struct Goal: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var skill_level: SkillLevel
    var timeframe: Timeframe
    var restrictions: [String]
    var requests: [String]
    var additional_context: String
    var followup_questions: [FollowupQuestion]
    var hours_per_week: Double
    var has_daily_limit: Bool
    var daily_limit_minutes: Int
    var selected_days: [String]

    enum SkillLevel: String, Codable, CaseIterable {
        case beginner, intermediate, advanced
    }
}

struct Timeframe: Codable, Equatable {
    var start_date: String
    var end_date: String
}

struct FollowupQuestion: Codable, Equatable {
    var question: String
    var emoji: String?
    var user_response: String
    var type: QuestionType?
    var options: [String]?

    enum QuestionType: String, Codable {
        case open_ended, boolean, multiple_choice, multi_select, scale
    }
}

// MARK: - Schedule

struct Schedule: Codable, Equatable {
    var timezone: String
    var free_slots: [String: [TimeSlot]]
    var recurring_blocks: [RecurringBlock]
    var specific_blocks: [SpecificBlock]
}

struct TimeSlot: Codable, Equatable {
    var start: String
    var end: String
}

struct RecurringBlock: Codable, Identifiable, Equatable {
    var id: String
    var label: String
    var days: [String]
    var start_time: String
    var end_time: String
}

struct SpecificBlock: Codable, Identifiable, Equatable {
    var id: String
    var label: String
    var date: String
    var all_day: Bool
    var start_time: String
    var end_time: String
}

// MARK: - Plan

struct DayPlan: Codable, Identifiable, Equatable {
    var id: String { date }
    var date: String
    var objective: String
    var time_blocks: [TimeBlock]
}

struct TimeBlock: Codable, Identifiable, Equatable {
    var id: String
    var goal_id: String?
    var label: String
    var start_time: String?
    var end_time: String?
    var tasks: [PlanTask]

    init(id: String, goal_id: String? = nil, label: String, start_time: String? = nil, end_time: String? = nil, tasks: [PlanTask]) {
        self.id = id; self.goal_id = goal_id; self.label = label
        self.start_time = start_time; self.end_time = end_time; self.tasks = tasks
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        goal_id = try? c.decode(String.self, forKey: .goal_id)
        label = try c.decode(String.self, forKey: .label)
        start_time = try? c.decode(String.self, forKey: .start_time)
        end_time = try? c.decode(String.self, forKey: .end_time)
        tasks = try c.decode([PlanTask].self, forKey: .tasks)
    }
}

struct PlanTask: Codable, Equatable {
    var title: String
    var description: String
    var estimated_minutes: Int
    var completed: Bool?
}

// MARK: - API response wrappers

struct GenerateResponse: Codable {
    var weekly_tasks: [DayPlan]
}

struct UserData: Codable {
    var goals: [Goal]?
    var schedule: Schedule?
    var plan: [DayPlan]?
}
