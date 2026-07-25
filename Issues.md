# Known Issues

Open problems worth planning around, logged with enough detail to pick back up later without re-deriving context. See `PLANNING.md` for the build history and `Navigation.md`/`Genres.md` for how the map/genre layers work.

---

## Android: app becomes unresponsive / blank-white after the location-permission step

**Status:** Unresolved, root cause unconfirmed. First encountered 2026-07-25 while getting the app running on Android for the first time.

### Environment

- Tauri Android target, `tauri android dev`
- Emulator: `Pixel5_API35` (Android 15 / API 35, `google_apis` x86_64 image, system WebView Chromium 124)
- Host: Windows, dev server via `npm run tauri android dev` / `npx tauri android dev`

### What works, confirmed on-device

Genre-select screen, class-select screen (card selection + confirm), and the first three onboarding steps (intro narration, ability reveal, location-permission prompt) all render correctly and respond to touch (`adb shell input tap`) using real app content — screenshotted and verified at each step. Two real environment bugs were found and fixed to get this far (see "Fixes already applied" below).

### What's broken

Pushing through the location-permission step to reach the map screen was not completed. Two things happened, and it's unclear whether they're the same root cause or two separate issues:

1. **An unexpected full-page reload reset in-progress onboarding state.** `store.onboardingStep` isn't persisted to `localStorage` (only `chosenGenre`/`chosenClass` are — see `src/stores/player.js`), so any full reload mid-onboarding drops the user back to the `intro` step, or in one observed case all the way back to the genre-select screen. Suspected cause: Vite's HMR websocket (port **1421**) wasn't forwarded via `adb reverse` (only port 1420, the main dev server port, was) — the client's repeated failed reconnect attempts may trigger Vite's fallback full-reload behavior. **Partially addressed**: `adb reverse tcp:1421 tcp:1421` was added mid-session, but the fix was not re-verified before the session ended.

2. **The app process died outright** shortly after tapping "GRANT ACCESS" on the location-permission step. `adb logcat` showed:
   ```
   ActivityTaskManager: Background activity launch blocked! [...
     intent: Intent { act=android.content.pm.action.REQUEST_PERMISSIONS pkg=com.google.android.permissioncontroller
     cmp=com.google.android.permissioncontroller/...GrantPermissionsActivity ... }
     callingPackage: com.natrix.ff_navigation ...]
   ActivityManager: Process com.natrix.ff_navigation (pid 4621) has died: fg TOP
   ```
   No Java/Kotlin exception trace (`AndroidRuntime: FATAL EXCEPTION`) accompanied the death, and no native crash/tombstone signature was captured either — the process just stopped.

   **Working theory, unconfirmed:** location permission had already been pre-granted out-of-band via `adb shell pm grant ... ACCESS_FINE_LOCATION`. When the in-page JS then called `navigator.geolocation.getCurrentPosition()` (`LocationPermissionStep.vue`), the WebView/wry layer may still have attempted to launch Android's native permission-request activity despite the permission already being granted, and Android's Background Activity Launch (BAL) protection blocked that launch — synthetic `adb shell input tap` events likely don't carry the same "recent user interaction" provenance a real touchscreen tap does, which BAL checks rely on. If that's right, this may be **specific to testing via `adb shell input tap`** rather than a bug real users would hit — but this has not been verified with genuine touchscreen/emulator-window input.

3. **On relaunching the app after the crash, the WebView showed blank white again** — the same symptom as the original Chromium-91 syntax-error bug (see below), but this time on the already-fixed Chromium 124 WebView, so it's very unlikely to be the same cause. Not yet diagnosed: could be a cold-start timing issue (screenshot taken before the WebView finished loading), a residual effect of the HMR reload, or something new. The session was interrupted before this could be narrowed down.

### Fixes already applied this session (for context, not part of the open issue)

- **Network**: Tauri defaults to binding the dev server to the host's LAN IP on Windows, which the emulator's virtual NAT can't reach. Fixed with `tauri android dev --host 127.0.0.1` + `adb reverse tcp:1420 tcp:1420`.
- **WebView too old**: the original `Pixel_5_API_31` AVD (Android 12, `google_apis` image) shipped Chromium 91, which cannot parse MapLibre GL's bundled JS (`Uncaught SyntaxError: Unexpected token '{'` in `maplibre-gl.mjs`), crashing the module graph before Vue mounted. Fixed by creating a new AVD on a newer system image (`system-images;android-35;google_apis;x86_64`, Chromium 124).

### Next steps to try

- [ ] Re-run the location-permission → map flow with `adb reverse tcp:1421` already in place from the start, to see if the mid-flow reload is actually gone.
- [ ] Reproduce using genuine input in the emulator's GUI window (mouse clicks on the emulator UI) instead of `adb shell input tap`, to test the BAL/synthetic-input theory directly.
- [ ] If the crash reproduces with real input too, capture a full `adb logcat` (unfiltered) across the crash window and look for a native tombstone (`DEBUG: *** *** ***`) or Rust panic output, since no Java exception was found.
- [ ] Once past the location step reliably, confirm MapLibre GL actually renders (WebGL context creation, tile load, marker/route rendering) on-device — this is the one piece of the map foundation (`Navigation.md`) never actually verified on Android/mobile GPU drivers, only in desktop Chromium via Playwright.
- [ ] Consider persisting `onboardingStep` to `localStorage` alongside `chosenGenre`/`chosenClass` regardless of the reload's root cause — losing onboarding progress on any unexpected reload (not just this one) is a rough edge worth closing generally.
