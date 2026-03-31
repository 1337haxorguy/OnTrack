import SwiftUI

extension Notification.Name {
    static let onboardingComplete = Notification.Name("onboardingComplete")
}

@MainActor
class OnboardingFlowState: ObservableObject {
    @Published var goalText = ""
    @Published var questions: [FollowupQuestion] = []
    @Published var answers: [String] = []
    @Published var isLoading = false
    @Published var loadFailed = false

    private var fetchTask: Task<Void, Never>?

    func fetchQuestions(auth: AuthManager) {
        guard !goalText.isEmpty else { return }
        fetchTask?.cancel()
        isLoading = true
        loadFailed = false
        questions = []
        answers = []
        fetchTask = Task {
            let token = await auth.getToken()
            guard !Task.isCancelled else { return }
            do {
                let result = try await APIService.fetchFollowupQuestions(
                    title: goalText,
                    skillLevel: "beginner",
                    restrictions: [], requests: [], context: "",
                    token: token
                )
                guard !Task.isCancelled else { return }
                let finalQuestion = FollowupQuestion(
                    question: "is there anything else you want us to know?",
                    emoji: "💬",
                    user_response: "",
                    type: .open_ended,
                    options: nil
                )
                questions = result + [finalQuestion]
                answers = Array(repeating: "", count: questions.count)
            } catch {
                if !Task.isCancelled { loadFailed = true }
            }
            if !Task.isCancelled { isLoading = false }
        }
    }
}
