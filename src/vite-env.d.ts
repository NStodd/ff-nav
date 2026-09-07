/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Overridable backend endpoints — see .env.example and Navigation.md's
// production-readiness notes. Undefined in dev, where navigation.js falls
// back to the public demo servers.
interface ImportMetaEnv {
  readonly VITE_OSRM_BASE?: string
  readonly VITE_OVERPASS_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
