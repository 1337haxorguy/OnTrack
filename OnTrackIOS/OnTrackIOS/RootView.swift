import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Tab = .goals

    enum Tab { case goals, today, calendar, recap, schedule }

    var body: some View {
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

    private var loadingView: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ProgressView()
                .tint(.indigo)
                .scaleEffect(1.5)
        }
    }
}
