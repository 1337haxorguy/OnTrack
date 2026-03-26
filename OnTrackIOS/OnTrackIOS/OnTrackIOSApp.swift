import SwiftUI

@main
struct OnTrackIOSApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authManager)
                .environmentObject(appState)
        }
    }
}
