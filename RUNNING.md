# Running Crystal Path

There are two ways to run the app: **browser mode** (fast, no Rust required) and **desktop mode** (full Tauri window, requires Rust).

---

## Prerequisites

### Always required

- **Node.js** 18 or later
- Dependencies installed:

  ```bash
  cd FF_Navigation
  npm install
  ```

### Required only for desktop (Tauri) mode

- **Rust** — install via [rustup](https://rustup.rs):

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **Tauri system dependencies** — on Windows, Visual Studio C++ Build Tools are required. The official guide is at <https://tauri.app/start/prerequisites/>.

---

## Option 1 — Browser mode (recommended for UI development)

Starts the Vite dev server only. No Rust compile step.

```bash
npm run dev
```

Then open **http://localhost:1420** in your browser.

- Port 1420 is fixed (`strictPort: true` in `vite.config.ts`). If something else is already using that port the server will refuse to start.
- Hot Module Replacement (HMR) is active — edits to `.vue` files and `.js` files update the browser instantly without a full reload.
- Changes to `src-tauri/` are ignored by the file watcher in this mode.

---

## Option 2 — Desktop mode (full Tauri app)

Compiles the Rust backend, then launches a native desktop window pointing at the Vite dev server. Tauri automatically starts `npm run dev` as its `beforeDevCommand`, so you do **not** need to run `npm run dev` separately.

```bash
npm run tauri dev
```

What happens in order:

1. Tauri runs `npm run dev` (starts Vite on port 1420)
2. Rust compiles the backend (first run takes several minutes; subsequent runs are much faster)
3. A native window opens at 800 × 600 (as configured in `tauri.conf.json`)
4. The window auto-reloads on frontend changes via HMR; Rust changes trigger a recompile

---

## Building for production

### Frontend only (static files)

```bash
npm run build
```

Output goes to `dist/`. This runs `vue-tsc --noEmit` (type-check) then `vite build`.

### Full desktop installer

```bash
npm run tauri build
```

Runs the frontend build, then compiles a release Rust binary and packages it into a platform installer (`.msi` on Windows, `.dmg` on macOS, `.AppImage`/`.deb` on Linux). Output is under `src-tauri/target/release/bundle/`.

---

## Preview the production build in a browser

```bash
npm run build && npm run preview
```

Serves the `dist/` folder locally so you can verify the production bundle before packaging.

---

## Ports used

| Port | Purpose |
|------|---------|
| 1420 | Vite dev server (HTTP) |
| 1421 | Vite HMR WebSocket (only when running inside Tauri dev) |

---

## Common problems

**Port 1420 already in use**
Find and kill the process using it, or temporarily change the port in `vite.config.ts` (and update `devUrl` in `tauri.conf.json` to match).

**`@tauri-apps/cli` not found**
Run `npm install` from the `FF_Navigation/` directory. The CLI is a local dev dependency, not a global install.

**Rust compile errors on first `tauri dev`**
Make sure the Rust toolchain is up to date (`rustup update`) and that the required system libraries are installed for your platform (see Tauri prerequisites link above).

**Google Fonts not loading (Press Start 2P)**
The font is loaded from Google's CDN via `@import` in `main.css`. If you're offline or the request is blocked, the app falls back to `monospace` — layout is preserved but the pixel font won't appear.
