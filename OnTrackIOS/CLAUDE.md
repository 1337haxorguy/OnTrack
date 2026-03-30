# OnTrack iOS — Design System & Figma Integration Rules

## Stack
- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Min Target**: iOS 17+
- **Package Manager**: Swift Package Manager
- **Dependencies**: Auth0 2.18, JWTDecode 3.3, SimpleKeychain 1.3

---

## Project Structure

```
OnTrackIOS/OnTrackIOS/
  OnTrackIOSApp.swift     — @main entry point, injects AuthManager + AppState env objects
  RootView.swift          — Auth gate: loading → LandingView → tabView
  LandingView.swift       — Unauthenticated splash/onboarding screen
  Models.swift            — All shared data types (Goal, Schedule, DayPlan, etc.)
  AppState.swift          — @MainActor ObservableObject; global state + API_BASE constant
  AuthManager.swift       — @MainActor ObservableObject; Auth0 session management
  APIService.swift        — Static async API helpers (generate, regenerate, followup, validate)
  Assets.xcassets/        — Image assets (AppIcon, AccentColor, splash images)
  Views:
    GoalsView.swift       — Goals list + empty state
    CreateGoalView.swift  — Multi-step goal creation form
    CalendarView.swift    — Weekly plan with regen/reschedule
    TodayView.swift       — Today's tasks
    RecapView.swift       — Progress recap
    ScheduleView.swift    — Availability settings
    ToastView.swift       — Bottom toast notifications
```

---

## Design Tokens

No dedicated token file — values are used inline. Established conventions:

### Colors
| Token | SwiftUI Value | Usage |
|-------|--------------|-------|
| Primary | `Color.indigo` | CTAs, active states, progress indicators |
| Background | `Color.black` | Root screen backgrounds |
| Surface subtle | `Color.white.opacity(0.04)` | Card backgrounds |
| Surface interactive | `Color.white.opacity(0.06)` | Input/button backgrounds |
| Surface border | `Color.white.opacity(0.08)` | Card/pill borders |
| Overlay | `Color.white.opacity(0.10)` | Strong accents |
| Primary tint bg | `Color.indigo.opacity(0.12)` | Tag/chip backgrounds |
| Primary tint selected | `Color.indigo.opacity(0.25)` | Selected pill state |
| Body text | `Color.white` | Primary text |
| Secondary text | `Color.gray` | Subtitles, placeholders |
| Destructive | `Color.red` | Delete actions |
| Destructive bg | `Color.red.opacity(0.12)` | Destructive button background |
| Warning | `Color.orange` | Stale/outdated plan states |

### Typography
| Role | SwiftUI |
|------|---------|
| Large title | `.font(.title2.bold())` |
| Section header | `.font(.subheadline.weight(.semibold))` |
| Caption header | `.font(.caption.weight(.medium))` |
| Body | `.font(.subheadline)` |
| Small label | `.font(.caption)` |
| Micro label | `.font(.caption2)` |
| Button (primary) | `.font(.subheadline.weight(.semibold))` |

### Spacing & Corner Radius
| Value | Usage |
|-------|-------|
| `spacing: 4` | Related inline groups |
| `spacing: 8` | Small sections |
| `spacing: 12` | Calendar/block cards |
| `spacing: 16` | Major scroll sections |
| `padding: 14` | Card internal padding |
| `padding: 16` | Screen container padding |
| `cornerRadius: 6` | Chips/tags |
| `cornerRadius: 8` | Small buttons, time slots |
| `cornerRadius: 12` | Calendar cards, banners |
| `cornerRadius: 14` | Primary cards, toasts |
| `cornerRadius: 20` | Pill-shaped buttons/tags |

---

## Styling Approach

- **Pure SwiftUI** — no UIKit, no external styling library.
- Styling is **inline** on each view. No global stylesheet or theme object.
- Dark-first design: backgrounds are `Color.black`, surfaces are `white.opacity(0.06)`.
- Responsive layout uses `GeometryReader` only when pixel-precise positioning is needed (e.g. splash screen background scaling). Otherwise use SwiftUI's adaptive layout system.
- Safe area: use `.ignoresSafeArea()` on full-bleed backgrounds; let SwiftUI handle safe area insets for interactive content.

---

## Component Patterns

### Primary Button
```swift
Button { /* action */ } label: {
    HStack {
        if loading { ProgressView().tint(.white).scaleEffect(0.8) }
        else { Text("Label").font(.subheadline.weight(.semibold)) }
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 14)
    .background(Color.indigo)
    .foregroundColor(.white)
    .cornerRadius(12)
}
.disabled(loading)
```

### Destructive Button
```swift
Button { /* delete */ } label: {
    Text("Delete goal")
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color.red.opacity(0.12))
        .foregroundColor(.red)
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.red.opacity(0.25), lineWidth: 1))
}
```

### Pill/Tag Button (Multi-select)
```swift
Button(action: action) {
    HStack(spacing: 4) {
        if selected { Image(systemName: "checkmark").font(.caption2.weight(.bold)) }
        Text(label).font(.caption)
    }
    .padding(.horizontal, 12).padding(.vertical, 7)
    .background(selected ? Color.indigo.opacity(0.25) : Color.white.opacity(0.06))
    .foregroundColor(selected ? .indigo : .gray)
    .cornerRadius(20)
    .overlay(Capsule().stroke(selected ? Color.indigo.opacity(0.5) : Color.white.opacity(0.08), lineWidth: 1))
}
```

### Surface Card
```swift
VStack(alignment: .leading, spacing: 10) { /* content */ }
    .padding(14)
    .background(Color.white.opacity(0.04))
    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
    .cornerRadius(14)
```

### Highlighted/Selected Card
```swift
.background(isSelected ? Color.indigo.opacity(0.08) : Color.white.opacity(0.04))
.overlay(RoundedRectangle(cornerRadius: 14).stroke(
    isSelected ? Color.indigo.opacity(0.3) : Color.white.opacity(0.08), lineWidth: 1))
```

### Warning Banner
```swift
HStack {
    Image(systemName: "exclamationmark.triangle").foregroundColor(.orange)
    Text("Message").font(.caption.weight(.medium)).foregroundColor(.orange)
    Spacer()
}
.padding(12)
.background(Color.orange.opacity(0.1))
.overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.orange.opacity(0.3), lineWidth: 1))
.cornerRadius(12)
```

### Info/Read-only Tag
```swift
Text("Beginner")
    .font(.caption2)
    .padding(.horizontal, 8).padding(.vertical, 4)
    .background(Color.indigo.opacity(0.12))
    .foregroundColor(.indigo)
    .cornerRadius(20)
    .overlay(Capsule().stroke(Color.indigo.opacity(0.2), lineWidth: 1))
```

### Empty State
```swift
VStack(spacing: 16) {
    ZStack {
        RoundedRectangle(cornerRadius: 16).fill(Color.indigo.opacity(0.2)).frame(width: 64, height: 64)
        Image(systemName: "target").font(.system(size: 28)).foregroundColor(.indigo)
    }
    Text("No goals yet").font(.title2.bold()).foregroundColor(.white)
    Text("Subtitle description.")
        .font(.subheadline).foregroundColor(.gray)
        .multilineTextAlignment(.center).padding(.horizontal, 40)
    Button { /* action */ } label: {
        Text("CTA").font(.subheadline.weight(.semibold))
            .padding(.horizontal, 24).padding(.vertical, 12)
            .background(Color.indigo).foregroundColor(.white).cornerRadius(12)
    }
}
```

### Screen Container
```swift
ScrollView {
    VStack(alignment: .leading, spacing: 16) { /* content */ }
        .padding(.horizontal, 16)
        .padding(.top, 16)
}
.background(Color.black.ignoresSafeArea())
.navigationBarTitleDisplayMode(.large)
```

### Expandable Section
```swift
VStack(spacing: 0) {
    Button(action: { withAnimation { expanded.toggle() } }) {
        HStack {
            // header
            Spacer()
            Image(systemName: expanded ? "chevron.up" : "chevron.down")
                .font(.caption).foregroundColor(.gray)
        }
        .padding(14)
    }
    .buttonStyle(.plain)
    if expanded {
        Divider().background(Color.white.opacity(0.06))
        // expanded content
    }
}
.background(Color.white.opacity(0.04))
.overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.08), lineWidth: 1))
.cornerRadius(14)
```

### Progress Bar (Inline)
```swift
ZStack(alignment: .leading) {
    Capsule().fill(Color.white.opacity(0.08)).frame(width: 60, height: 4)
    Capsule().fill(Color.indigo).frame(width: 60 * CGFloat(done) / CGFloat(total), height: 4)
}
```

### Divider Between List Items
```swift
ForEach(Array(items.enumerated()), id: \.offset) { i, item in
    ItemView(item: item)
    if i < items.count - 1 {
        Divider().background(Color.white.opacity(0.04)).padding(.leading, 40)
    }
}
```

### @ViewBuilder Field Helper (used in forms)
```swift
@ViewBuilder
private func field<C: View>(label: String, @ViewBuilder content: () -> C) -> some View {
    VStack(alignment: .leading, spacing: 8) {
        Text(label).font(.caption.weight(.medium)).foregroundColor(.gray)
        content()
    }
}
```

---

## Asset Management

- All images go in `Assets.xcassets/` as `.imageset` folders.
- Each imageset has a `Contents.json` declaring the `1x` filename; `2x`/`3x` slots left empty unless separate resolutions are supplied.
- Reference in SwiftUI: `Image("asset_name")` — no extension needed.
- For full-bleed images: `.resizable().scaledToFill()` + `.clipped()` inside a sized container.
- For pixel-precise layout from Figma (e.g. background offset): use `GeometryReader` and multiply by fractional values derived from Figma's percentage-based positioning.

### Figma Asset Download Convention
When a Figma design exports image assets via MCP URLs:
1. `curl -sL <url> -o Assets.xcassets/<name>.imageset/<name>.png`
2. Write `Contents.json` in the imageset folder
3. Reference via `Image("<name>")`

---

## Icon System

- Uses **SF Symbols** exclusively (`Image(systemName: "...")`)
- No custom icon files
- Common symbols used: `target`, `sun.max`, `calendar`, `checkmark.circle`, `clock`, `plus`, `chevron.right`, `trash`

---

## Figma → SwiftUI Conversion Rules

When converting Figma/React+Tailwind output to SwiftUI:

| Figma/Tailwind concept | SwiftUI equivalent |
|------------------------|-------------------|
| `absolute inset-0` | `.ignoresSafeArea()` or `ZStack` fill |
| `object-cover size-full` | `.resizable().scaledToFill().clipped()` |
| `w-[188%] h-[108%] left-[-2.72%]` | `GeometryReader` + fractional `.frame` + `.offset` |
| `overflow-clip` | `.clipped()` |
| `rounded-[40px]` | `.cornerRadius(40)` |
| `shadow-[...]` | `.shadow(color:, radius:, x:, y:)` |
| `rgba(0,0,0,0.12)` | `Color.black.opacity(0.12)` |
| Layered `<div>` stack | `ZStack { }` |
| `pointer-events-none` | `.allowsHitTesting(false)` |
| `gap-N` in flex column | `VStack(spacing: N)` |
| `px-N py-N` padding | `.padding(.horizontal, N).padding(.vertical, N)` |

---

## Landing / Login Screen (Light Theme)

The landing screen uses a **separate light theme** — do not apply dark-theme tokens here.

| Token | Value |
|-------|-------|
| Background | `Color(red: 251/255, green: 250/255, blue: 247/255)` — warm cream `#fbfaf7` |
| Primary text | `Color.black` |
| Secondary text | `Color.black.opacity(0.4)` |
| CTA button | `Color.black` pill, `cornerRadius(100)` |
| Card border | `Color.white.opacity(0.5)`, `lineWidth: 0.85` |
| Card gradient | `LinearGradient(clear→black.opacity(0.5), top→bottom)` |

### Typography (Landing Screen)
| Role | Value |
|------|-------|
| "ON TRACK" letters | `.system(size: 58, weight: .bold)`, tracking `-1.74` |
| Subtitle | `.system(size: 22, weight: .medium)`, tracking `-0.66` |
| CTA button | `.system(size: 22, weight: .semibold)`, tracking `-0.66` |
| Card title | `.system(size: 17, weight: .bold)`, tracking `-0.51` |
| Card schedule/task | `.system(size: 11, weight: .medium)`, tracking `-0.34` |

> **Note**: Figma uses **Epilogue** (Bold/Medium/SemiBold). Current implementation uses SF Pro system fonts. To match exactly, embed `Epilogue-Bold.ttf`, `Epilogue-Medium.ttf`, `Epilogue-SemiBold.ttf` in the project, declare in `Info.plist` under `UIAppFonts`, and use `.custom("Epilogue-Bold", size: x)`.

### "ON TRACK" Curved Text
Each letter is individually rotated and offset. Positions are derived from Figma's path-text layout (computed as offsets from ZStack center):

```swift
ZStack {
    curvedLetter("O", offsetX: -128, offsetY:  18, rotation: -22.17)
    curvedLetter("N", offsetX:  -89, offsetY:  -1, rotation: -16.07)
    curvedLetter("T", offsetX:  -32, offsetY:  -8, rotation:   6.13)
    curvedLetter("R", offsetX:    6, offsetY:   1, rotation:   6.13)
    curvedLetter("A", offsetX:   45, offsetY:   3, rotation:   6.13)
    curvedLetter("C", offsetX:   85, offsetY:   1, rotation:  -7.48)
    curvedLetter("K", offsetX:  128, offsetY: -18, rotation: -25.32)
}
.frame(maxWidth: .infinity, minHeight: 105, maxHeight: 105)
```

### Goal Card Fan Layout
Four 200×275pt cards in a `ZStack(alignment: .topLeading)` with a 318×354pt container:
```
card_baking2 → offset(x: 118, y: 0)   // back
card_baking1 → offset(x: 77,  y: 30)
card_guitar  → offset(x: 36,  y: 49)
card_novel   → offset(x: 0,   y: 79)   // front
```

### Splash → Landing Flow
`RootView` tracks `@State private var splashDone = false`. On appear, a 3-second `Task.sleep` fires then fades the splash out with `.easeInOut(duration: 0.6)`. The splash images (`splash_bg`, `splash_overlay`) are fixed to `UIScreen.main.bounds.size` to avoid SwiftUI layout ambiguity.

---

## Architecture Notes

- **State**: Two `@MainActor ObservableObject` singletons (`AuthManager.shared`, `AppState.shared`) injected as `@EnvironmentObject` at the root. Access via `@EnvironmentObject var auth: AuthManager`.
- **API**: All network calls go through `APIService` static methods. Base URL in `API_BASE` constant in `AppState.swift`.
- **Navigation**: `RootView` is a state machine (loading/unauth/loading-data/tabs). Tabs are `TabView` with enum-typed selection. Modal flows use `.sheet`.
- **Multi-step forms**: `@State private var step: Int` drives section visibility within a single view (see `CreateGoalView`).
- **Sheet dismissal from deep NavigationStack**: Never use `@Published` flags + `onChange` chains or closure captures — SwiftUI struct copies silently no-op. The working pattern is to put the `isPresented` binding on `AppState` (a shared `@MainActor` singleton), then set it to `false` directly from anywhere. e.g. `appState.showingOnboarding = false` closes the sheet owned by `GoalsView`.
- **Onboarding sheet**: `GoalsView` binds its sheet to `$appState.showingOnboarding`. `GeneratingView` closes it by setting `appState.showingOnboarding = false` directly.

---

## Adding a New Swift File to the Xcode Target

**Every new `.swift` file must be manually registered in `OnTrackIOS.xcodeproj/project.pbxproj` or Xcode will throw "Cannot find X in scope" even though the file exists on disk.**

Do all four edits in one pass. Use unique placeholder UUIDs (e.g. `AABBCCDD...`):

### 1. PBXBuildFile section (near top of file)
```
AA000001AA000001AA000001 /* MyView.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA000002AA000002AA000002 /* MyView.swift */; };
```

### 2. PBXFileReference section
```
AA000002AA000002AA000002 /* MyView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = MyView.swift; path = OnTrackIOS/MyView.swift; sourceTree = "<group>"; };
```

### 3. PBXGroup (the source files list, ~line 135)
```
AA000002AA000002AA000002 /* MyView.swift */,
```

### 4. PBXSourcesBuildPhase (the compile sources list, ~line 325)
```
AA000001AA000001AA000001 /* MyView.swift in Sources */,
```

Use `grep -n "SomeExistingFile" project.pbxproj` to find the exact line numbers for sections 3 and 4.

---

## SourceKit Diagnostics — False Positives

SourceKit analyzes files **in isolation** and cannot resolve types defined in other files. This produces errors like:
- `Cannot find type 'Goal' in scope`
- `Cannot find 'APIService' in scope`
- `Cannot infer contextual base in reference to member 'calendar'`

**These are NOT real build errors.** If the app compiled and ran before your edit, ignore them. Only act on errors that appear in the Xcode build log (red banner, "Build Failed").

Real errors to act on: missing memberwise inits after adding `init(from decoder:)`, `@MainActor` isolation violations, and genuine missing symbol errors confirmed by a failed build.

---

## Debug Mode

`RootView` has a `#if DEBUG` block that bypasses auth and shows content directly:
```swift
#if DEBUG
// put whatever view you want here to test it
#else
// normal auth gate
#endif
```

`OnTrackIOSApp.swift` has a `loadMockData(into:)` function that pre-populates `AppState` with a mock goal and 3-day plan so all tabs show realistic content without hitting the API.
