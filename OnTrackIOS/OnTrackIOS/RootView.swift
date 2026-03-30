import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .goals
    @State private var splashDone = false

    private var screenSize: CGSize { UIScreen.main.bounds.size }

    enum Tab { case goals, today, calendar, recap, schedule }

    var body: some View {
        ZStack {
            mainContent

            if !splashDone {
                splashView
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .onAppear {
            Task {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                withAnimation(.easeInOut(duration: 0.6)) {
                    splashDone = true
                }
            }
        }
    }

    // MARK: - Main content (post-splash)

    @ViewBuilder
    private var mainContent: some View {
        Group {
            if auth.isLoading {
                loadingView
            } else if !auth.isAuthenticated {
                LandingView()
            } else if !appState.dataLoaded {
                loadingView
            } else {
                tabView
            }
        }
        .overlay(alignment: .bottom) {
            if let toast = appState.toast {
                ToastView(toast: toast) {
                    if let route = toast.actionRoute {
                        switch route {
                        case .today:    selectedTab = .today
                        case .calendar: selectedTab = .calendar
                        case .goals:    selectedTab = .goals
                        case .recap:    selectedTab = .recap
                        }
                    }
                    appState.dismissToast()
                } onDismiss: {
                    appState.dismissToast()
                }
                .padding(.bottom, 8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .animation(.spring(), value: appState.toast != nil)
            }
        }
    }

    // MARK: - Splash screen

    private var splashView: some View {
        ZStack {
            Image("splash_bg")
                .resizable()
                .scaledToFill()
                .frame(width: screenSize.width, height: screenSize.height)
                .clipped()

            Image("splash_overlay")
                .resizable()
                .scaledToFill()
                .frame(width: screenSize.width, height: screenSize.height)
                .clipped()
        }
        .ignoresSafeArea()
    }

    // MARK: - Loading screen

    private var loadingView: some View {
        Color(red: 251/255, green: 250/255, blue: 247/255)
            .ignoresSafeArea()
            .overlay(
                ProgressView()
                    .tint(Color(red: 0.2, green: 0.2, blue: 0.2))
                    .scaleEffect(1.2)
            )
    }

    // MARK: - Tab view

    private var tabView: some View {
        TabView(selection: $selectedTab) {
            GoalsView()
                .tabItem { Label("Goals", systemImage: "target") }
                .tag(Tab.goals)

            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max") }
                .tag(Tab.today)

            CalendarView()
                .tabItem { Label("Calendar", systemImage: "calendar") }
                .tag(Tab.calendar)

            RecapView()
                .tabItem { Label("Recap", systemImage: "checkmark.circle") }
                .tag(Tab.recap)

            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "clock") }
                .tag(Tab.schedule)
        }
    }
}
