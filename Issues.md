# Known Issues

Open problems worth planning around, logged with enough detail to pick back up later without re-deriving context. See `PLANNING.md` for the build history and `Navigation.md`/`Genres.md` for how the map/genre layers work.

---

## Android: app crashed after the location-permission step (RESOLVED)

**Status:** Resolved 2026-09-05. First encountered 2026-07-25 while getting the app running on Android for the first time; root cause found and fixed in a follow-up session.

### Environment

- Tauri Android target, `tauri android dev`
- Emulator: `Pixel5_API35` (Android 15 / API 35, `google_apis` x86_64 image, system WebView Chromium 124)
- Host: Windows, dev server via `npm run tauri android dev` / `npx tauri android dev`

### Root cause

`src-tauri/gen/android/app/src/main/AndroidManifest.xml` never declared `android.permission.ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` — only `INTERNET` was present (the stock `tauri android init` template; nothing in this codebase added them, since onboarding calls the raw `navigator.geolocation` Web API rather than a Tauri geolocation plugin that would inject its own manifest permissions).

Without those declarations, tapping "GRANT ACCESS"/"ENABLE LOCATION" set off a tight failure loop, confirmed via `adb logcat -v threadtime` across the crash window:

1. `LocationPermissionStep.vue` calls `navigator.geolocation.getCurrentPosition()`.
2. Tauri's generated `RustWebChromeClient.onGeolocationPermissionsShowPrompt()` (`src-tauri/gen/android/app/src/main/java/.../generated/RustWebChromeClient.kt:266`) tries to request the two location permissions via an `ActivityResultLauncher`.
3. Android's `GrantPermissionsActivity` logs `GrantPermissionsViewModel: None of [android.permission.ACCESS_COARSE_LOCATION, android.permission.ACCESS_FINE_LOCATION] in {}` — it has nothing to grant, because the app never declared either permission — and relaunches itself five to six times in well under a second.
4. One of those relaunches calls `permissionLauncher.launch()` on a launcher the Activity Result API no longer considers registered, throwing an **uncaught `java.lang.IllegalStateException: Attempting to launch an unregistered ActivityResultLauncher ... You must ensure the ActivityResultLauncher is registered before calling launch().`**
5. The uncaught exception kills the process: `ActivityManager: Process com.natrix.ff_navigation has died: fg TOP`.

This is the same "process has died: fg TOP" symptom logged in the original 2026-07-25 session, now with a full stack trace pinning the actual cause. The original session's Background-Activity-Launch theory (that `adb shell input tap`'s synthetic events lack "recent user interaction" provenance) did **not** reproduce this time and was a red herring — `GrantPermissionsActivity` launched successfully every time; the crash was the missing-permission exception above, not a blocked launch.

### Fix

Added the two missing declarations to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### Verified on-device, post-fix

Full flow re-run from a clean install, Final Fantasy → White Mage, through every onboarding step to the map:

- Tapping "ENABLE LOCATION" now shows the real native Android permission dialog ("Allow ff_navigation to access this device's location?", Precise/Approximate, While using the app/Only this time/Don't allow) — no crash, no reload, same process (`pid` unchanged) throughout.
- Granting it resolves `getCurrentPosition()` ("Location acquired. Ready to navigate.") and proceeds through the fanfare (`DoneStep`) into the map screen without incident.
- This also gave us the first real on-device confirmation of **Milestone 3**: MapLibre GL renders actual CARTO Dark Matter vector tiles (buildings, roads, labels) via WebGL on the emulator's GPU, the class-colored user marker appears at the resolved position, and tapping the map to set a destination draws a real OSRM-routed polyline in the class color with a gold destination marker and a live ETA in the HUD (`2 min` in the test run). None of this had previously been verified outside desktop Chromium/Playwright — see `Navigation.md`.

### Fixes applied in the original 2026-07-25 session (for context, unaffected by the above)

- **Network**: Tauri defaults to binding the dev server to the host's LAN IP on Windows, which the emulator's virtual NAT can't reach. Fixed with `tauri android dev --host 127.0.0.1` + `adb reverse tcp:1420 tcp:1420` (and, from this session on, `adb reverse tcp:1421 tcp:1421` for the HMR socket too, forwarded from the start — no reload was observed this session, so the port-1421 theory for the earlier reload symptom is plausible but not conclusively confirmed either way).
- **WebView too old**: the original `Pixel_5_API_31` AVD (Android 12, `google_apis` image) shipped Chromium 91, which cannot parse MapLibre GL's bundled JS (`Uncaught SyntaxError: Unexpected token '{'` in `maplibre-gl.mjs`), crashing the module graph before Vue mounted. Fixed by creating a new AVD on a newer system image (`system-images;android-35;google_apis;x86_64`, Chromium 124).

### Remaining follow-up (not blocking, general resilience)

- [ ] Persist `onboardingStep` to `localStorage` alongside `chosenGenre`/`chosenClass` — still worth doing generally so any unexpected reload (HMR hiccup, OS-level low-memory kill, etc.) doesn't drop a user back to `intro` mid-flow, independent of the crash above now being fixed.
- [ ] The destination-before-position race and the OSRM public-demo-server caveat noted in `Navigation.md` are unrelated and still open.
