import SwiftUI

struct HelloWorldView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            Text("Hello World")
                .font(.largeTitle.bold())
                .foregroundColor(.white)
        }
    }
}
