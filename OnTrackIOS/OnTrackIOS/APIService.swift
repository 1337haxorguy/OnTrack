import Foundation

struct APIService {

    // MARK: - Generate full plan

    static func generatePlan(goals: [Goal], schedule: Schedule, token: String?) async throws -> [DayPlan] {
        let totalHours = goals.reduce(0.0) { $0 + $1.hours_per_week }
        let body: [String: Any] = [
            "goals": encodeToAny(goals),
            "availability": encodeToAny(schedule),
            "preferences": ["hours_per_week": totalHours, "sessions_per_day": 1]
        ]
        let data = try await post(path: "/api/generate", body: body, token: token)
        let response = try JSONDecoder().decode(GenerateResponse.self, from: data)
        return response.weekly_tasks.map { day in
            var d = day
            d.time_blocks = d.time_blocks.map { block in
                var b = block
                b.id = UUID().uuidString
                return b
            }
            return d
        }
    }

    // MARK: - Regenerate single goal

    static func regenerateGoal(goal: Goal, schedule: Schedule, token: String?) async throws -> [DayPlan] {
        let body: [String: Any] = [
            "goals": encodeToAny([goal]),
            "availability": encodeToAny(schedule),
            "preferences": ["hours_per_week": goal.hours_per_week, "sessions_per_day": 1]
        ]
        let data = try await post(path: "/api/generate", body: body, token: token)
        let response = try JSONDecoder().decode(GenerateResponse.self, from: data)
        return response.weekly_tasks.map { day in
            var d = day
            d.time_blocks = d.time_blocks.map { block in
                var b = block
                b.id = UUID().uuidString
                b.goal_id = goal.id
                return b
            }
            return d
        }
    }

    // MARK: - Regenerate day

    static func regenerateDay(date: String, goals: [Goal], schedule: Schedule, feedback: String?, currentPlan: DayPlan?, token: String?) async throws -> DayPlan {
        var body: [String: Any] = [
            "date": date,
            "goals": encodeToAny(goals),
            "availability": encodeToAny(schedule),
        ]
        if let feedback { body["feedback"] = feedback }
        if let currentPlan { body["current_day_plan"] = encodeToAny(currentPlan) }

        let data = try await post(path: "/api/generate/regenerate-day", body: body, token: token)
        return try JSONDecoder().decode(DayPlan.self, from: data)
    }

    // MARK: - Follow-up questions

    struct FollowupResponse: Codable {
        struct Question: Codable {
            var question: String
            var mandatory: Bool
            var type: String
            var options: [String]?
        }
        var questions: [Question]
    }

    static func fetchFollowupQuestions(title: String, skillLevel: String, restrictions: [String], requests: [String], context: String, token: String?) async throws -> [FollowupQuestion] {
        let body: [String: Any] = [
            "title": title,
            "skill_level": skillLevel,
            "restrictions": restrictions,
            "requests": requests,
            "additional_context": context
        ]
        let data = try await post(path: "/api/generate/followup-questions", body: body, token: token)
        let response = try JSONDecoder().decode(FollowupResponse.self, from: data)
        return response.questions.map { q in
            FollowupQuestion(
                question: q.question,
                user_response: "",
                type: FollowupQuestion.QuestionType(rawValue: q.type),
                options: q.options?.isEmpty == false ? q.options : nil
            )
        }
    }

    // MARK: - Validate goal title

    struct ValidationResponse: Codable {
        var valid: Bool
        var reason: String
    }

    static func validateGoal(title: String) async throws -> ValidationResponse {
        let body: [String: Any] = ["title": title]
        let data = try await post(path: "/api/generate/validate-goal", body: body, token: nil)
        return try JSONDecoder().decode(ValidationResponse.self, from: data)
    }

    // MARK: - Private helpers

    private static func post(path: String, body: [String: Any], token: String?) async throws -> Data {
        guard let url = URL(string: "\(API_BASE)\(path)") else {
            throw URLError(.badURL)
        }
        let isAI = path.contains("generate")
        var req = URLRequest(url: url, timeoutInterval: isAI ? 90 : 20)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private static func encodeToAny<T: Encodable>(_ value: T) -> Any {
        guard let data = try? JSONEncoder().encode(value),
              let obj = try? JSONSerialization.jsonObject(with: data) else { return [:] }
        return obj
    }
}
