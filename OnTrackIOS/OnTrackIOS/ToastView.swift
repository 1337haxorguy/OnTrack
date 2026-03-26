import SwiftUI

struct ToastView: View {
    let toast: ToastMessage
    let onAction: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(toast.message)
                .font(.subheadline)
                .foregroundColor(.white)

            if let label = toast.actionLabel {
                Button(label, action: onAction)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.gray)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(white: 0.12))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
        .cornerRadius(14)
        .shadow(color: .black.opacity(0.4), radius: 16, y: 4)
        .padding(.horizontal, 16)
    }
}
