import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { TokenManager } from '../app/utils/api';
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
  lastUpdateSource: string; // Track where last update came from
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
  const [attendance, setAttendanceState] = useState<AttendanceState>(defaultState);
  const [lastUpdateSource, setLastUpdateSource] = useState('init');
  const lastUpdateTimeRef = useRef(Date.now());

  const persistToLocalStorage = useCallback((state: AttendanceState) => {
    try {
      const user = TokenManager.getUser();
      const userId = user?.id != null ? String(user.id) : null;
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
        timestamp: Date.now()
      });
      console.log('💾 [ATTENDANCE-CONTEXT] Saved attendance cache (canonical + mirrors)');
    } catch (e) {
      console.warn('Failed to save attendance cache:', e);
    }
  }, []);

  // Load from durable cache (IndexedDB + localStorage + legacy migration)
  const loadFromLocalStorage = useCallback(() => {
    void (async () => {
      try {
        const currentUser = TokenManager.getUser();
        const userId = currentUser?.id != null ? String(currentUser.id) : null;
        const payload = await readPersistedAttendance(userId);
        if (!payload || !isPayloadFresh(payload)) {
          return;
        }
        if (payload.userId != null && userId && String(payload.userId) !== String(userId)) {
          console.warn('⚠️ [ATTENDANCE-CONTEXT] Ignoring cached attendance: user mismatch');
          return;
        }
        console.log('📦 [ATTENDANCE-CONTEXT] Loaded from attendance cache:', payload);
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
  }, []);

  // Save to localStorage with timestamp
  const saveToLocalStorage = useCallback(() => {
    persistToLocalStorage(attendance);
  }, [attendance, persistToLocalStorage]);

  // Update specific fields with source tracking
  const updateAttendance = useCallback((updates: Partial<AttendanceState>, source = 'action') => {
    console.log('🔄 [ATTENDANCE-CONTEXT] Updating attendance from', source, ':', updates);
    lastUpdateTimeRef.current = Date.now();
    setLastUpdateSource(source);

    setAttendanceState(prev => {
      const newState = { ...prev, ...updates };
      persistToLocalStorage(newState);
      return newState;
    });
  }, [persistToLocalStorage]);

  // Reset to default state
  const resetAttendance = useCallback(() => {
    console.log('🔄 [ATTENDANCE-CONTEXT] Resetting attendance');
    const user = TokenManager.getUser();
    const userId = user?.id != null ? String(user.id) : null;
    setAttendanceState(defaultState);
    setLastUpdateSource('reset');
    try {
      clearPersistedAttendance(userId).catch(() => {
        /* non-fatal */
      });
    } catch (e) {
      console.warn('Failed to clear attendance cache:', e);
    }
  }, []);

  // Wrapper for setAttendance
  const setAttendance = useCallback((state: AttendanceState | ((prev: AttendanceState) => AttendanceState)) => {
    if (typeof state === 'function') {
      setAttendanceState(prev => {
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
  }, [persistToLocalStorage]);

  // Flush when tab goes to background or navigates away (mobile / sleep / reload)
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
