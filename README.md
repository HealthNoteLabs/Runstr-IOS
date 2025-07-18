# RUNSTR iOS

A minimal iOS version of RUNSTR - a Nostr-native cardio app with Bitcoin rewards.

## Phase 0 - Project Bootstrap ✅

This project implements Phase 0 of the RUNSTR iOS development plan:
- ✅ SwiftUI iOS app (iOS 17+ target)
- ✅ Local Nostr key generation and secure storage
- ✅ Basic relay connection setup
- ✅ Minimalist black/white UI theme
- ✅ Tab structure (Dashboard, Profile, Teams)

## Features

### Dashboard
- Displays generated Nostr public key (npub)
- Placeholder for run tracking (coming in Phase 1)

### Profile  
- Placeholder for workout history (Kind 1301 events)
- Coming in Phase 2

### Teams
- Placeholder for NIP-101e fitness teams
- Coming in Phase 3

## Technical Details

### Key Management
- **Local Key Generation**: Creates new secp256k1 keypair on first launch
- **Secure Storage**: Private key stored in iOS Keychain
- **No External Signer**: Self-contained, no Amber or external signing required

### Nostr Integration
- **Relay Support**: Connects to default relay set (Damus, nos.lol, Primal)
- **Event Types**: Ready for Kind 1301 (workout) and Kind 1 (text) events
- **NDK-Swift**: Prepared for integration (Phase 1)

### UI/UX
- **SwiftUI**: Native iOS 17+ framework
- **Dark Theme**: Black background with white text
- **Minimalist Design**: Clean, focused interface matching RUNSTR aesthetic

## Project Structure

```
RUNSTR-iOS/
├── RUNSTR-iOS/
│   ├── RUNSTRApp.swift          # Main app entry point
│   ├── ContentView.swift        # Tab view and main screens
│   ├── Services/
│   │   ├── NostrKeyManager.swift # Key generation & storage
│   │   └── RelayManager.swift    # Relay connection management
│   ├── Assets.xcassets/         # App icons and colors
│   └── Preview Content/         # SwiftUI preview assets
├── RUNSTR-iOS.xcodeproj/       # Xcode project file
└── README.md                   # This file
```

## Getting Started

### Requirements
- Xcode 15.0+
- iOS 17.0+ (Simulator or Device)
- No Apple Developer Program required for simulator testing

### Installation

1. **Open in Xcode**:
   ```bash
   open RUNSTR-iOS.xcodeproj
   ```

2. **Select Target**:
   - Choose iPhone simulator (any iOS 17+ device)
   - No code signing required for simulator

3. **Build and Run**:
   - Press `Cmd+R` or click the play button
   - App will launch in simulator

### First Launch
- App automatically generates a new Nostr keypair
- Public key (npub) displayed on Dashboard
- Private key securely stored in Keychain
- Attempts connection to default relays

## Next Steps (Phase 1)

- [ ] Integrate NDK-Swift for proper Nostr functionality
- [ ] Implement CoreLocation for run tracking
- [ ] Add Kind 1301 event creation and publishing
- [ ] Build "Start Run" → "Running" → "Finish" flow
- [ ] Add live metrics display (distance, duration, pace)

## Development Notes

### Without Apple Developer Program
- Full development and testing possible in iOS Simulator
- All features work except device-specific hardware (GPS, motion sensors)
- Can test Nostr key generation, UI, and basic relay connections
- Perfect for Phase 0 completion and UI development

### Future Considerations
- Device testing will require Apple Developer Program ($99/year)
- TestFlight distribution needs Developer Program
- CoreLocation and HealthKit require real device testing

## Dependencies (Planned)

- **NDK-Swift**: Nostr Development Kit for iOS
- **secp256k1**: Proper cryptographic key handling
- **CoreLocation**: GPS tracking for runs
- **CoreMotion**: Motion sensor data

---

**Status**: Phase 0 Complete ✅  
**Next**: Phase 1 - Dashboard MVP (Run Tracking) 