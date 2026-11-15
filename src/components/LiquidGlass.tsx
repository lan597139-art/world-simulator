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
    
    const Core: any = LiquidGlassCore;
    
    if (Core.isSupported && Core.isSupported()) {
      console.log('✅ WebGL2 支持，正在初始化...');
      try {
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
        console.log('✅ 液态玻璃初始化成功！');
        
        // 强制容器背景透明，防止 CSS 覆盖
        ref.current.style.setProperty('background', 'transparent', 'important');
        ref.current.style.setProperty('backdrop-filter', 'none', 'important');
        ref.current.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      } catch (e) {
        console.error('❌ 液态玻璃初始化失败:', e);
      }
    } else {
      console.warn('❌ 浏览器不支持 WebGL2');
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