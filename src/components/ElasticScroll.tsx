import { useEffect, useMemo, useRef, useState, forwardRef, type CSSProperties, type ReactNode } from 'react';

type ElasticScrollProps = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
};

export const ElasticScroll = forwardRef<HTMLDivElement, ElasticScrollProps>(
  ({ className, style, children, onContextMenu }, forwardedRef) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bounceTimerRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const [offsetY, setOffsetY] = useState(0);
  const [isRubberBanding, setIsRubberBanding] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<number | null>(null);

  const transition = useMemo(() => {
    if (isRubberBanding) return 'none';
    return 'transform 420ms cubic-bezier(0.19, 1, 0.22, 1)';
  }, [isRubberBanding]);
  
  // 合并 refs
  const setRefs = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (typeof forwardedRef === 'function') {
      forwardedRef(el);
    } else if (forwardedRef) {
      forwardedRef.current = el;
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const clearScrollTimer = () => {
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };

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

    const handleScroll = () => {
      setIsScrolling(true);
      clearScrollTimer();
      scrollTimerRef.current = window.setTimeout(() => {
        setIsScrolling(false);
        scrollTimerRef.current = null;
      }, 150);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearBounceTimer();
      clearScrollTimer();
      el.removeEventListener('wheel', handleWheel as EventListener);
      el.removeEventListener('scroll', handleScroll as EventListener);
    };
  }, []);

  return (
    <div className={className} style={{ ...style, overflow: 'hidden' }} onContextMenu={onContextMenu}>
      <div
        ref={setRefs}
        className={`elastic-scroll-body${isScrolling ? ' is-scrolling' : ''}`}
        style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none' }}
      >
        <div style={{ transform: `translateY(${offsetY}px)`, transition, height: '100%' }}>{children}</div>
      </div>
    </div>
  );
});

ElasticScroll.displayName = 'ElasticScroll';
