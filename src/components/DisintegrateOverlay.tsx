import { useEffect, useMemo } from 'react';

interface DisintegrateOverlayProps {
  onComplete: () => void;
  rows?: number;
  cols?: number;
}

export function DisintegrateOverlay({ onComplete, rows = 6, cols = 10 }: DisintegrateOverlayProps) {
  const particles = useMemo(() => {
    const items: {
      top: string;
      left: string;
      width: string;
      height: string;
      style: React.CSSProperties;
      key: string;
    }[] = [];

    const widthPct = 100 / cols;
    const heightPct = 100 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = (c / (cols - 1)) * 2 - 1;
        const ny = (r / (rows - 1)) * 2 - 1;

        const tx = nx * 150 + (Math.random() * 40 - 20);
        const ty = ny * 150 + (Math.random() * 40 - 20);

        const rx = Math.random() * 720 - 360;
        const ry = Math.random() * 720 - 360;

        items.push({
          key: `${r}-${c}`,
          top: `${r * heightPct}%`,
          left: `${c * widthPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          style: {
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
            '--rx': `${rx}deg`,
            '--ry': `${ry}deg`,
            animationDelay: `${Math.random() * 0.1}s`,
            opacity: 0.6 + Math.random() * 0.4,
          } as React.CSSProperties,
        });
      }
    }

    return items;
  }, [rows, cols]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      <div className="quantum-shockwave bg-primary/40" />
      {particles.map((p) => (
        <div
          key={p.key}
          className="quantum-particle bg-zinc-500/80 dark:bg-zinc-400/80"
          style={{
            top: p.top,
            left: p.left,
            width: p.width,
            height: p.height,
            ...p.style,
          }}
        />
      ))}
    </div>
  );
}

