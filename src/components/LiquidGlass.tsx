/* eslint-disable */
// @ts-nocheck
import { useEffect, useRef, ReactNode, CSSProperties } from 'react';
import { LiquidGlass as LiquidGlassCore } from 'apple-liquid-glass-webgl';

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
    
    // 强制当作 any 处理，绕过所有类型检查
    const Core: any = LiquidGlassCore;
    
    if (Core.isSupported && Core.isSupported()) {
      glassRef.current = new Core(ref.current, {
        tint: 0.2,
        tintTone: 'light',
        frost: 0.1,
        material: {
          refraction: 90,
          edgeReach: 0.15,
          dispersion: 3.0,
          rim: 0.4,
        }
      });
      
      // 使用原生 setProperty 移除原本 CSS 里的模糊，避免和 WebGL 效果叠加
      ref.current.style.setProperty('backdrop-filter', 'none');
      ref.current.style.setProperty('-webkit-backdrop-filter', 'none');
    }

    return () => {
      if (glassRef.current && typeof glassRef.current.destroy === 'function') {
        glassRef.current.destroy();
      }
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