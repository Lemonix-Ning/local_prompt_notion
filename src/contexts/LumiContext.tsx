import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type LumiAction =
  | 'create_card'
  | 'create_folder'
  | 'update'
  | 'delete'
  | 'restore'
  | 'favorite'
  | 'pin'
  | 'clipboard'
  | 'search'
  | 'rename';

export type LumiTransferState = 'importing' | 'exporting' | null;
export type LumiTimeState = 'alarm' | 'schedule' | null;
export type LumiAlert = { id: string; title: string } | null;

interface LumiContextValue {
  action: LumiAction | null;
  transferState: LumiTransferState;
  timeState: LumiTimeState;
  isWindy: boolean;
  isSleeping: boolean;
  isDragging: boolean;
  notificationMessage: string | null;
  alert: LumiAlert;
  triggerAction: (action: LumiAction, durationMs?: number) => void;
  triggerTransfer: (state: NonNullable<LumiTransferState>, durationMs?: number) => void;
  triggerTime: (state: NonNullable<LumiTimeState>, durationMs?: number) => void;
  reportScrollSpeed: (speed: number) => void;
  setDragging: (dragging: boolean) => void;
  notifyActivity: () => void;
  notifyMessage: (message: string, durationMs?: number) => void;
  notifyAlert: (payload: { id: string; title: string; onFocus: () => void; onDismiss: () => void; durationMs?: number }) => void;
  focusAlert: () => void;
  dismissAlert: () => void;
  clearAlert: () => void;
}

const LumiContext = createContext<LumiContextValue | undefined>(undefined);

const ACTION_DURATION_MS = 1500;
const TRANSFER_DURATION_MS = 2000;
const COUNTDOWN_DURATION_MS = 3000;
const SCHEDULE_DURATION_MS = 2000;
const WIND_DURATION_MS = 200;
const SLEEP_DURATION_MS = 30 * 1000;

export function LumiProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<LumiAction | null>(null);
  const [transferState, setTransferState] = useState<LumiTransferState>(null);
  const [timeState, setTimeState] = useState<LumiTimeState>(null);
  const [isWindy, setIsWindy] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [alert, setAlert] = useState<LumiAlert>(null);

  const actionTimerRef = useRef<number | null>(null);
  const transferTimerRef = useRef<number | null>(null);
  const timeTimerRef = useRef<number | null>(null);
  const windTimerRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const notificationTimerRef = useRef<number | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const alertHandlersRef = useRef<{ onFocus: () => void; onDismiss: () => void } | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const scheduleSleep = useCallback(() => {
    clearTimer(sleepTimerRef);
    sleepTimerRef.current = window.setTimeout(() => {
      setIsSleeping(true);
    }, SLEEP_DURATION_MS);
  }, []);

  const notifyActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isSleeping) {
      setIsSleeping(false);
    }
    scheduleSleep();
  }, [isSleeping, scheduleSleep]);

  const triggerAction = useCallback((nextAction: LumiAction, durationMs = ACTION_DURATION_MS) => {
    notifyActivity();
    setAction(nextAction);
    clearTimer(actionTimerRef);
    actionTimerRef.current = window.setTimeout(() => {
      setAction(null);
    }, durationMs);
  }, [notifyActivity]);

  const triggerTransfer = useCallback((state: NonNullable<LumiTransferState>, durationMs = TRANSFER_DURATION_MS) => {
    notifyActivity();
    setTransferState(state);
    clearTimer(transferTimerRef);
    transferTimerRef.current = window.setTimeout(() => {
      setTransferState(null);
    }, durationMs);
  }, [notifyActivity]);

  const triggerTime = useCallback((state: NonNullable<LumiTimeState>, durationMs?: number) => {
    notifyActivity();
    setTimeState(state);
    clearTimer(timeTimerRef);
    const duration = durationMs ?? (state === 'alarm' ? COUNTDOWN_DURATION_MS : SCHEDULE_DURATION_MS);
    timeTimerRef.current = window.setTimeout(() => {
      setTimeState(null);
    }, duration);
  }, [notifyActivity]);

  const reportScrollSpeed = useCallback((speed: number) => {
    if (speed <= 2.0) {
      return;
    }
    setIsWindy(true);
    clearTimer(windTimerRef);
    windTimerRef.current = window.setTimeout(() => {
      setIsWindy(false);
    }, WIND_DURATION_MS);
  }, []);

  const setDragging = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
    if (dragging) {
      notifyActivity();
    }
  }, [notifyActivity]);

  const notifyMessage = useCallback((message: string, durationMs = 3000) => {
    setNotificationMessage(message);
    clearTimer(notificationTimerRef);
    notificationTimerRef.current = window.setTimeout(() => {
      setNotificationMessage(null);
    }, durationMs);
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(null);
    alertHandlersRef.current = null;
    clearTimer(alertTimerRef);
  }, []);

  const notifyAlert = useCallback(
    (payload: { id: string; title: string; onFocus: () => void; onDismiss: () => void; durationMs?: number }) => {
      setAlert({ id: payload.id, title: payload.title });
      alertHandlersRef.current = { onFocus: payload.onFocus, onDismiss: payload.onDismiss };
      clearTimer(alertTimerRef);
      const duration = payload.durationMs ?? 5000;
      if (duration > 0) {
        alertTimerRef.current = window.setTimeout(() => {
          alertHandlersRef.current?.onDismiss();
          clearAlert();
        }, duration);
      }
    },
    [clearAlert]
  );

  const focusAlert = useCallback(() => {
    if (!alertHandlersRef.current) return;
    alertHandlersRef.current.onFocus();
    clearAlert();
  }, [clearAlert]);

  const dismissAlert = useCallback(() => {
    if (!alertHandlersRef.current) return;
    alertHandlersRef.current.onDismiss();
    clearAlert();
  }, [clearAlert]);

  useEffect(() => {
    scheduleSleep();
    return () => {
      clearTimer(actionTimerRef);
      clearTimer(transferTimerRef);
      clearTimer(timeTimerRef);
      clearTimer(windTimerRef);
      clearTimer(sleepTimerRef);
      clearTimer(notificationTimerRef);
      clearTimer(alertTimerRef);
    };
  }, [scheduleSleep]);

  useEffect(() => {
    const handleActivity = () => {
      notifyActivity();
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [notifyActivity]);

  const value: LumiContextValue = {
    action,
    transferState,
    timeState,
    isWindy,
    isSleeping,
    isDragging,
    notificationMessage,
    alert,
    triggerAction,
    triggerTransfer,
    triggerTime,
    reportScrollSpeed,
    setDragging,
    notifyActivity,
    notifyMessage,
    notifyAlert,
    focusAlert,
    dismissAlert,
    clearAlert,
  };

  return (
    <LumiContext.Provider value={value}>
      {children}
    </LumiContext.Provider>
  );
}

export function useLumi() {
  const context = useContext(LumiContext);
  if (!context) {
    throw new Error('useLumi must be used within a LumiProvider');
  }
  return context;
}
