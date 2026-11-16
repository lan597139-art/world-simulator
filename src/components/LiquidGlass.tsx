/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef, ReactNode, CSSProperties } from 'react';
import { LiquidGlass as LiquidGlassCore } from 'apple-liquid-glass-webgl';
import { getAppliedAppearance, type GlassProfile } from '../utils/appearance';

function materialFor(profile: GlassProfile) {
  return {
    tint: Math.min(0.9, (profile.tint / 100) * (profile.opacity / 100) * 2),
    tintTone: 'auto' as const,
    frost: profile.frost / 100,
    material: {
      // 面板滑块 0-100；WebGL 材质的有效区间分别约为 0-110 与 0-7。
      refraction: profile.refraction * 1.1,
      dispersion: profile.dispersion * 0.07,
      frost: profile.frost / 100,
      backdropBlur: profile.blur * 0.35,
      edgeReach: 0.14,
      rim: Math.min(0.8, (profile.border / 100) * 0.8),
    },
  };
}

export function LiquidGlass({
  children,
  className = '',
  style = {},
  onClick,
  'aria-label': ariaLabel
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glassRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current) return;
    const Core: any = LiquidGlassCore;
    const canUse = () => {
      const appearance = getAppliedAppearance();
      return appearance.glass_targets.includes('liquid') && Boolean(Core.isSupported?.());
    };

    const destroy = () => {
      if (glassRef.current && typeof glassRef.current.destroy === 'function') {
        glassRef.current.destroy();
      }
      glassRef.current = null;
    };

    const mount = () => {
      if (!ref.current) return;
      const appearance = getAppliedAppearance();
      if (!appearance.glass_targets.includes('liquid')) {
        ref.current.removeAttribute('data-liquid-glass');
        return;
      }
      if (!Core.isSupported?.()) {
        ref.current.setAttribute('data-liquid-glass', 'fallback');
        return;
      }
      try {
        const appearance = getAppliedAppearance();
        glassRef.current = new Core(ref.current, materialFor(appearance.glass_profiles.liquid));
      } catch {
        // WebGL 上下文不足时由 CSS 毛玻璃兜底，不打断页面。
        glassRef.current = null;
        ref.current?.setAttribute('data-liquid-glass', 'fallback');
      }
    };

    const sync = (event?: Event) => {
      const appearance = (event as CustomEvent)?.detail || getAppliedAppearance();
      if (!appearance.glass_targets.includes('liquid')) {
        destroy();
        ref.current?.removeAttribute('data-liquid-glass');
        return;
      }
      if (!Core.isSupported?.()) {
        destroy();
        ref.current?.setAttribute('data-liquid-glass', 'fallback');
        return;
      }
      if (!glassRef.current) {
        mount();
        return;
      }
      try {
        glassRef.current.update(materialFor(appearance.glass_profiles.liquid));
      } catch {
        destroy();
        mount();
      }
    };

    mount();
    window.addEventListener('ws:appearance-change', sync);
    return () => {
      window.removeEventListener('ws:appearance-change', sync);
      destroy();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, position: 'relative', cursor: 'pointer' }}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
