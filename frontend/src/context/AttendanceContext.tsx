import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../app/context/AuthContext';
import {
  readPersistedAttendance,
  writePersistedAttendance,
  clearPersistedAttendance,
  isPayloadFresh
} from '../app/utils/attendancePersistence';

export interface AttendanceState {
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursWorked: number;
  status: string;
  isOnBreak: boolean;
  currentBreakDuration: number;
  breakType: string;
}

interface AttendanceContextType {
  attendance: AttendanceState;
  setAttendance: (state: AttendanceState | ((prev: AttendanceState) => AttendanceState)) => void;
  updateAttendance: (updates: Partial<AttendanceState>, source?: string) => void;
  resetAttendance: () => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
  lastUpdateSource: string;
}

const defaultState: AttendanceState = {
  isCheckedIn: false,
  checkInTime: null,
  checkOutTime: null,
  hoursWorked: 0,
  status: 'absent',
  isOnBreak: false,
  currentBreakDuration: 0,
  breakType: 'regular'
};

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [attendance, setAttendanceState] = useState<AttendanceState>(defaultState);
  const [lastUpdateSource, setLastUpdateSource] = useState('init');
  const lastUpdateTimeRef = useRef(Date.now());
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  const resolveUserId = useCallback((): string | null => {
    const id = user?.id ?? user?.userId;
    return id != null ? String(id) : null;
  }, [user?.id, user?.userId]);

  const persistToLocalStorage = useCallback(
    (state: AttendanceState) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        try {
          const userId = resolveUserId();
          writePersistedAttendance(userId, {
            userId,
            checkedIn: state.isCheckedIn,
            isCheckedIn: state.isCheckedIn,
            checkInTime: state.checkInTime,
            checkOutTime: state.checkOutTime,
            currentHours: state.hoursWorked,
            hoursWorked: state.hoursWorked,
            status: state.status,
            isOnBreak: state.isOnBreak,
            currentBreakDuration: state.currentBreakDuration,
            breakType: state.breakType,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.warn('Failed to save attendance cache:', e);
        }
      }, 120);
    },
    [resolveUserId]
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const loadFromLocalStorage = useCallback(() => {
    void (async () => {
      try {
        const userId = resolveUserId();
        if (!userId) return;

        const payload = await readPersistedAttendance(userId);
        if (!payload || !isPayloadFresh(payload)) {
          return;
        }
        if (payload.userId != null && String(payload.userId) !== String(userId)) {
          console.warn('⚠️ [ATTENDANCE-CONTEXT] Ignoring cached attendance: user mismatch');
          return;
        }
        setAttendanceState({
          isCheckedIn: payload.checkedIn || payload.isCheckedIn || false,
          checkInTime: payload.checkInTime || null,
          checkOutTime: payload.checkOutTime || null,
          hoursWorked: payload.currentHours || payload.hoursWorked || 0,
          status: payload.status || 'absent',
          isOnBreak: payload.isOnBreak || false,
          currentBreakDuration: payload.currentBreakDuration || 0,
          breakType: payload.breakType || 'regular'
        });
        setLastUpdateSource('localStorage');
      } catch (e) {
        console.warn('Failed to load attendance cache:', e);
      }
    })();
  }, [resolveUserId]);

  const saveToLocalStorage = useCallback(() => {
    persistToLocalStorage(attendance);
  }, [attendance, persistToLocalStorage]);

  const updateAttendance = useCallback(
    (updates: Partial<AttendanceState>, source = 'action') => {
      lastUpdateTimeRef.current = Date.now();
      setLastUpdateSource(source);
      setAttendanceState((prev) => {
        const newState = { ...prev, ...updates };
        persistToLocalStorage(newState);
        return newState;
      });
    },
    [persistToLocalStorage]
  );

  const resetAttendance = useCallback(() => {
    const userId = resolveUserId();
    setAttendanceState(defaultState);
    setLastUpdateSource('reset');
    void clearPersistedAttendance(userId).catch(() => {});
  }, [resolveUserId]);

  const setAttendance = useCallback(
    (state: AttendanceState | ((prev: AttendanceState) => AttendanceState)) => {
      if (typeof state === 'function') {
        setAttendanceState((prev) => {
          const newState = state(prev);
          setLastUpdateSource('direct');
          persistToLocalStorage(newState);
          return newState;
        });
      } else {
        setAttendanceState(state);
        setLastUpdateSource('direct');
        persistToLocalStorage(state);
      }
    },
    [persistToLocalStorage]
  );

  useEffect(() => {
    const uid = user?.id ?? user?.userId;
    const uidStr = uid != null ? String(uid) : null;

    if (!uidStr) {
      setAttendanceState(defaultState);
      setLastUpdateSource('init');
      prevUserIdRef.current = null;
      return;
    }

    if (prevUserIdRef.current != null && prevUserIdRef.current !== uidStr) {
      setAttendanceState(defaultState);
      setLastUpdateSource('user_change');
    }
    prevUserIdRef.current = uidStr;
    loadFromLocalStorage();
  }, [user?.id, user?.userId, loadFromLocalStorage]);

  useEffect(() => {
    const flush = () => {
      try {
        persistToLocalStorage(attendance);
      } catch {
        /* ignore */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [attendance, persistToLocalStorage]);

  return (
    <AttendanceContext.Provider
      value={{
        attendance,
        setAttendance,
        updateAttendance,
        resetAttendance,
        loadFromLocalStorage,
        saveToLocalStorage,
        lastUpdateSource
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within AttendanceProvider');
  }
  return context;
};
