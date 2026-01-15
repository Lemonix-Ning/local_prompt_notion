import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type ElasticScrollProps = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
};

export function ElasticScroll({ className, style, children, onContextMenu }: ElasticScrollProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bounceTimerRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const [offsetY, setOffsetY] = useState(0);
  const [isRubberBanding, setIsRubberBanding] = useState(false);

  const transition = useMemo(() => {
    if (isRubberBanding) return 'none';
    return 'transform 420ms cubic-bezier(0.19, 1, 0.22, 1)';
  }, [isRubberBanding]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const clearBounceTimer = () => {
      if (bounceTimerRef.current) {
        window.clearTimeout(bounceTimerRef.current);
        bounceTimerRef.current = null;
      }
    };

    const scheduleBounceBack = () => {
      clearBounceTimer();
      bounceTimerRef.current = window.setTimeout(() => {
        offsetRef.current = 0;
        setIsRubberBanding(false);
        setOffsetY(0);
      }, 90);
    };

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const handleWheel = (e: WheelEvent) => {
      // trackpad: deltaY can be tiny; keep it smooth
      const deltaY = e.deltaY;

      const scrollTop = el.scrollTop;
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);

      const atTop = scrollTop <= 0;
      const atBottom = scrollTop >= maxScrollTop - 0.5;

      const pullingDownAtTop = atTop && deltaY < 0;
      const pullingUpAtBottom = atBottom && deltaY > 0;

      if (!pullingDownAtTop && !pullingUpAtBottom) {
        // normal scroll region: if we were rubber banding, snap back smoothly
        if (offsetRef.current !== 0) {
          offsetRef.current = 0;
          setIsRubberBanding(false);
          setOffsetY(0);
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setIsRubberBanding(true);

      const current = offsetRef.current;
      const nextRaw = current + deltaY * 0.35;

      // resistance increases with distance
      const damp = 1 / (1 + Math.abs(nextRaw) / 60);
      const next = clamp(current + deltaY * 0.35 * damp, -88, 88);

      offsetRef.current = next;
      setOffsetY(next);

      scheduleBounceBack();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      clearBounceTimer();
      el.removeEventListener('wheel', handleWheel as EventListener);
    };
  }, []);

  return (
    <div className={className} style={{ ...style, overflow: 'hidden' }} onContextMenu={onContextMenu}>
      <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none' }}>
        <div style={{ transform: `translateY(${offsetY}px)`, transition, height: '100%' }}>{children}</div>
      </div>
    </div>
  );
}
