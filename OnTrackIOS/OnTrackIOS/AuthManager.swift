import Foundation
import Combine
import Auth0
import JWTDecode

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var userEmail: String? = nil
    @Published var userName: String? = nil

    private(set) var accessToken: String? = nil
    private let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

    init() {
        Task { await checkSession() }
    }

    // MARK: - Check existing session on launch

    private func checkSession() async {
        do {
            let credentials = try await credentialsManager.credentials()
            apply(credentials)
            isLoading = false
            await AppState.shared.loadUserData(token: credentials.accessToken)
        } catch {
            isAuthenticated = false
            isLoading = false
        }
    }

    // MARK: - Login

    func login() async {
        do {
            let credentials = try await Auth0
                .webAuth()
                .audience("https://ontrack-api")
                .scope("openid profile email offline_access")
                .start()
            _ = credentialsManager.store(credentials: credentials)
            apply(credentials)
            await AppState.shared.loadUserData(token: credentials.accessToken)
        } catch {
            print("Login error:", error)
        }
    }

    // MARK: - Logout

    func logout() async {
        do {
            try await Auth0.webAuth().clearSession()
        } catch {
            print("Logout error:", error)
        }
        _ = credentialsManager.clear()
        isAuthenticated = false
        accessToken = nil
        userEmail = nil
        userName = nil
        let state = AppState.shared
        state.goals = []
        state.schedule = defaultSchedule()
        state.plan = nil
        state.dataLoaded = false
    }

    // MARK: - Get fresh token

    func getToken() async -> String? {
        do {
            let credentials = try await credentialsManager.credentials()
            accessToken = credentials.accessToken
            return credentials.accessToken
        } catch {
            return accessToken
        }
    }

    // MARK: - Private

    private func apply(_ credentials: Credentials) {
        accessToken = credentials.accessToken
        isAuthenticated = true
        let idToken = credentials.idToken
        if !idToken.isEmpty, let jwt = try? decode(jwt: idToken) {
            userEmail = jwt["email"].string
            userName = jwt["name"].string
        }
    }
}
