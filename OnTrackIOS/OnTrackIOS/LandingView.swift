import SwiftUI

struct LandingView: View {
    @EnvironmentObject var auth: AuthManager
    @State private var loading = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo / icon
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.indigo.opacity(0.2))
                        .frame(width: 80, height: 80)
                    Image(systemName: "target")
                        .font(.system(size: 36))
                        .foregroundColor(.indigo)
                }
                .padding(.bottom, 28)

                Text("OnTrack")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.bottom, 12)

                Text("Turn your goals into a weekly plan,\nautomatically.")
                    .font(.subheadline)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 48)

                Button {
                    loading = true
                    Task {
                        await auth.login()
                        loading = false
                    }
                } label: {
                    HStack {
                        if loading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Get started")
                                .font(.system(size: 16, weight: .semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .cornerRadius(14)
                }
                .disabled(loading)
                .padding(.horizontal, 32)

                Spacer()
            }
        }
    }
}
