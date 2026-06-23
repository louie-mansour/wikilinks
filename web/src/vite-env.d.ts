/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  /** Analytics environment tag (default: local) */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'd3-force-3d' {
  export function forceX<T>(x?: number | ((node: T, i: number, nodes: T[]) => number)): {
    (alpha: number): void;
    strength(strength: number | ((node: T, i: number, nodes: T[]) => number)): typeof forceX;
    x(x: number | ((node: T, i: number, nodes: T[]) => number)): typeof forceX;
  };
}
