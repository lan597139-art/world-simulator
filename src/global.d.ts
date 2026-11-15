declare module '3d-force-graph';
declare module 'apple-liquid-glass-webgl' {
  export class LiquidGlass {
    constructor(element: HTMLElement, options?: {
      tint?: number;
      tintTone?: 'light' | 'dark' | 'auto';
      frost?: number;
      material?: {
        refraction?: number;
        edgeReach?: number;
        dispersion?: number;
        rim?: number;
      };
    });
    static isSupported(): boolean;
    destroy(): void;
  }
}