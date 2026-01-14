import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface AnimationState {
  top: string | number;
  left: string | number;
  width: string | number;
  height: string | number;
  borderRadius: string;
  opacity: number;
  transform?: string;
  isOpen: boolean;
  backdropBlur?: number;
}

interface NewPromptOverlayProps {
  isOpen: boolean;
  originId: string;
  targetState?: {
    top: string | number;
    left: string | number;
    width: string | number;
    height: string | number;
    borderRadius?: string;
    transform?: string;
    backdropBlur?: number;
  };
  onRequestClose: () => void;
  onClosed: () => void;
  children: ReactNode;
}

export function NewPromptOverlay({
  isOpen,
  originId,
  targetState,
  onRequestClose,
  onClosed,
  children,
}: NewPromptOverlayProps) {
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevIsOpenRef = useRef<boolean>(false);

  const durationOpenMs = 400;
  const durationCloseMs = 280;

  const openTransition = useMemo(
    () =>
      'top 0.4s cubic-bezier(0.19, 1, 0.22, 1), left 0.4s cubic-bezier(0.19, 1, 0.22, 1), width 0.4s cubic-bezier(0.19, 1, 0.22, 1), height 0.4s cubic-bezier(0.19, 1, 0.22, 1), transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease',
    []
  );

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!mounted || !isOpen) return;

    setIsClosing(false);

    const origin = document.getElementById(originId);
    if (origin) {
      const rect = origin.getBoundingClientRect();
      origin.style.opacity = '0';

      const startState: AnimationState = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: '12px',
        opacity: 1,
        isOpen: false,
        backdropBlur: 0,
      };

      setAnimationState(startState);

      requestAnimationFrame(() => {
        setTimeout(() => {
          const target: AnimationState = {
            top: targetState?.top ?? '10%',
            left: targetState?.left ?? '50%',
            width: targetState?.width ?? 'min(92%, 960px)',
            height: targetState?.height ?? '80%',
            borderRadius: targetState?.borderRadius ?? '16px',
            opacity: 1,
            transform: targetState?.transform ?? 'translateX(-50%)',
            isOpen: true,
            backdropBlur: targetState?.backdropBlur ?? 12,
          };
          setAnimationState(target);
        }, 10);
      });
    } else {
      const fallbackState: AnimationState = {
        top: targetState?.top ?? '10%',
        left: targetState?.left ?? '50%',
        width: targetState?.width ?? 'min(92%, 960px)',
        height: targetState?.height ?? '80%',
        transform: targetState?.transform ?? 'translateX(-50%)',
        borderRadius: targetState?.borderRadius ?? '16px',
        opacity: 1,
        isOpen: true,
        backdropBlur: targetState?.backdropBlur ?? 12,
      };

      setAnimationState(fallbackState);
    }
  }, [mounted, isOpen, originId, targetState]);

  useEffect(() => {
    if (!mounted || !isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRequestClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mounted, isOpen, onRequestClose]);

  const runClose = () => {
    if (isClosing) return;
    if (!animationState) {
      setMounted(false);
      setAnimationState(null);
      setIsClosing(false);
      onClosed();
      return;
    }

    setIsClosing(true);

    const origin = document.getElementById(originId);
    const originRect = origin ? origin.getBoundingClientRect() : null;

    if (origin) {
      setTimeout(() => {
        origin.style.opacity = '1';
      }, Math.floor(durationCloseMs * 0.7));
    }

    const closeState: AnimationState = originRect
      ? {
          top: originRect.top,
          left: originRect.left,
          width: originRect.width,
          height: originRect.height,
          borderRadius: '12px',
          opacity: 1,
          transform: 'none',
          isOpen: false,
          backdropBlur: 0,
        }
      : {
          ...animationState,
          opacity: 0,
          transform: `${animationState.transform || ''} scale(0)`,
          isOpen: false,
          backdropBlur: 0,
        };

    setAnimationState(closeState);

    setTimeout(() => {
      setMounted(false);
      setAnimationState(null);
      setIsClosing(false);
      onClosed();
    }, durationCloseMs);
  };

  useEffect(() => {
    const prevIsOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    // 触发关闭动画：当外部把 isOpen 从 true -> false
    if (mounted && prevIsOpen && !isOpen) {
      runClose();
    }
  }, [isOpen, mounted]);

  useEffect(() => {
    // 清理：确保 origin 显示恢复
    return () => {
      const origin = document.getElementById(originId);
      if (origin) origin.style.opacity = '1';
    };
  }, [originId]);

  if (!mounted || !animationState) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: `blur(${animationState.backdropBlur || 0}px)`,
          zIndex: 99990,
          transition: isClosing
            ? `backdrop-filter ${durationCloseMs}ms cubic-bezier(0.4, 0, 0.2, 1), background-color ${durationCloseMs}ms ease`
            : `backdrop-filter ${durationOpenMs}ms ease, background-color ${durationOpenMs}ms ease`,
        }}
        onClick={onRequestClose}
      />

      <div
        style={{
          position: 'fixed',
          overflow: 'hidden',
          transformOrigin: 'center center',
          transition: isClosing
            ? `all ${durationCloseMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : openTransition,
          top: animationState.top,
          left: animationState.left,
          width: animationState.width,
          height: animationState.height,
          borderRadius: animationState.borderRadius,
          opacity: animationState.opacity,
          transform: animationState.transform || 'none',
          zIndex: 100000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            opacity: animationState.isOpen ? 1 : 0,
            transition: `opacity 0.3s ease ${animationState.isOpen ? '0.1s' : '0s'}`,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
