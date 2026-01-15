interface EmptyStateProps {
  title: string;
  description?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}

export function EmptyState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground select-none">
      <div className="animate-empty-float">
        <svg
          viewBox="0 0 200 200"
          width="220"
          height="220"
          role="img"
          aria-label="Empty"
        >
          <defs>
            <linearGradient id="boxGradient" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--empty-fill)" stopOpacity="0" offset="0" />
              <stop stopColor="var(--empty-fill)" stopOpacity="1" offset="1" />
            </linearGradient>
          </defs>

          <g className="animate-empty-pulse" transform="translate(100 92)">
            <circle r="46" fill="var(--empty-accent)" style={{ filter: 'blur(40px)' }} />
          </g>

          <g>
            <path
              d="M60 82 L100 60 L140 82 L140 130 L100 152 L60 130 Z"
              fill="url(#boxGradient)"
              stroke="var(--empty-stroke)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M60 82 L100 104 L140 82"
              fill="none"
              stroke="var(--empty-stroke)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M100 104 L100 152"
              fill="none"
              stroke="var(--empty-stroke)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>

          <g>
            <circle
              cx="42"
              cy="74"
              r="3"
              fill="var(--sidebar-item-active-text)"
              className="animate-bounce"
              style={{ animationDelay: '0.2s', transform: 'translateY(-25%)' }}
            />
            <circle cx="158" cy="96" r="2.5" fill="var(--sidebar-item-active-text)" className="animate-empty-bounce-2" />
            <circle cx="58" cy="146" r="2" fill="var(--sidebar-item-active-text)" className="animate-empty-bounce-3" />
            <path
              d="M152 64 L165 56"
              stroke="var(--sidebar-item-active-text)"
              strokeOpacity="0.6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M40 112 L28 118"
              stroke="var(--sidebar-item-active-text)"
              strokeOpacity="0.45"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      <div className="mt-4 text-center max-w-[520px] px-6">
        <div className="text-base font-medium text-foreground">{title}</div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={onPrimaryAction}
            className="btn-create px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
