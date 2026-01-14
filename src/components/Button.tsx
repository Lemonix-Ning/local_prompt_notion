import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'default' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'icon';

export function Button({
  children,
  className,
  variant = 'default',
  size = 'md',
  disabled,
  type,
  ...props
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = `btn inline-flex items-center justify-center rounded-lg transition-colors select-none`;

  const sizeClass =
    size === 'icon'
      ? 'w-9 h-9'
      : size === 'sm'
        ? 'px-3 py-1.5 text-sm'
        : 'px-4 py-2 text-sm';

  const variantClass = variant === 'ghost' ? 'btn-ghost' : '';

  const finalClassName = `${base} ${sizeClass} ${variantClass} ${className || ''}`.trim();

  return (
    <button
      type={type ?? 'button'}
      className={finalClassName}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
