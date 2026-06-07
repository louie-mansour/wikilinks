/// <reference types="vite/client" />

declare module 'd3-force-3d' {
  export function forceX<T>(x?: number | ((node: T, i: number, nodes: T[]) => number)): {
    (alpha: number): void;
    strength(strength: number | ((node: T, i: number, nodes: T[]) => number)): typeof forceX;
    x(x: number | ((node: T, i: number, nodes: T[]) => number)): typeof forceX;
  };
}
