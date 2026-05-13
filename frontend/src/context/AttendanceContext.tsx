import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

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

  // Get today's date string for localStorage key
  const getTodayKey = () => new Date().toDateString();

  // Validate localStorage state is not stale (max 24 hours old)
  const isLocalStorageStateFresh = useCallback((): boolean => {
    try {
      const today = getTodayKey();
      const cached = localStorage.getItem(`checkedIn_${today}`);
      if (!cached) return false;
      
      const parsed = JSON.parse(cached);
      const timestamp = parsed.timestamp || 0;
      const now = Date.now();
      const age = now - timestamp;
      
      // If state is older than 24 hours, consider it stale
      if (age > 24 * 60 * 60 * 1000) {
        console.log('⚠️ [ATTENDANCE-CONTEXT] localStorage state is stale (age:', age, 'ms)');
        return false;
      }
      
      return true;
    } catch (e) {
      console.warn('Failed to validate localStorage freshness:', e);
      return false;
    }
  }, []);

  // Load from localStorage - ONLY on initial mount, never during sync
  const loadFromLocalStorage = useCallback(() => {
    try {
      const today = getTodayKey();
      const cached = localStorage.getItem(`checkedIn_${today}`);
      if (cached && isLocalStorageStateFresh()) {
        const parsed = JSON.parse(cached);
        console.log('📦 [ATTENDANCE-CONTEXT] Loaded from localStorage:', parsed);
        setAttendanceState({
          isCheckedIn: parsed.checkedIn || parsed.isCheckedIn || false,
          checkInTime: parsed.checkInTime || null,
          checkOutTime: parsed.checkOutTime || null,
          hoursWorked: parsed.currentHours || parsed.hoursWorked || 0,
          status: parsed.status || 'absent',
          isOnBreak: parsed.isOnBreak || false,
          currentBreakDuration: parsed.currentBreakDuration || 0,
          breakType: parsed.breakType || 'regular'
        });
        setLastUpdateSource('localStorage');
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }, [isLocalStorageStateFresh]);

  // Save to localStorage with timestamp
  const saveToLocalStorage = useCallback(() => {
    try {
      const today = getTodayKey();
      const stateToSave = {
        checkedIn: attendance.isCheckedIn,
        isCheckedIn: attendance.isCheckedIn,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        currentHours: attendance.hoursWorked,
        hoursWorked: attendance.hoursWorked,
        status: attendance.status,
        isOnBreak: attendance.isOnBreak,
        currentBreakDuration: attendance.currentBreakDuration,
        breakType: attendance.breakType,
        timestamp: Date.now() // Add timestamp for freshness validation
      };
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
      console.log('💾 [ATTENDANCE-CONTEXT] Saved to localStorage:', stateToSave);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [attendance]);

  // Update specific fields with source tracking
  const updateAttendance = useCallback((updates: Partial<AttendanceState>, source = 'action') => {
    console.log('🔄 [ATTENDANCE-CONTEXT] Updating attendance from', source, ':', updates);
    lastUpdateTimeRef.current = Date.now();
    setLastUpdateSource(source);
    
    setAttendanceState(prev => {
      const newState = { ...prev, ...updates };
      // Auto-save to localStorage after update
      setTimeout(() => {
        try {
          const today = getTodayKey();
          const stateToSave = {
            checkedIn: newState.isCheckedIn,
            isCheckedIn: newState.isCheckedIn,
            checkInTime: newState.checkInTime,
            checkOutTime: newState.checkOutTime,
            currentHours: newState.hoursWorked,
            hoursWorked: newState.hoursWorked,
            status: newState.status,
            isOnBreak: newState.isOnBreak,
            currentBreakDuration: newState.currentBreakDuration,
            breakType: newState.breakType,
            timestamp: Date.now()
          };
          localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
        } catch (e) {
          console.warn('Failed to auto-save to localStorage:', e);
        }
      }, 0);
      return newState;
    });
  }, []);

  // Reset to default state
  const resetAttendance = useCallback(() => {
    console.log('🔄 [ATTENDANCE-CONTEXT] Resetting attendance');
    setAttendanceState(defaultState);
    setLastUpdateSource('reset');
    try {
      const today = getTodayKey();
      localStorage.removeItem(`checkedIn_${today}`);
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }, []);

  // Wrapper for setAttendance
  const setAttendance = useCallback((state: AttendanceState | ((prev: AttendanceState) => AttendanceState)) => {
    if (typeof state === 'function') {
      setAttendanceState(prev => {
        const newState = state(prev);
        setLastUpdateSource('direct');
        // Auto-save to localStorage
        setTimeout(() => {
          try {
            const today = getTodayKey();
            const stateToSave = {
              checkedIn: newState.isCheckedIn,
              isCheckedIn: newState.isCheckedIn,
              checkInTime: newState.checkInTime,
              checkOutTime: newState.checkOutTime,
              currentHours: newState.hoursWorked,
              hoursWorked: newState.hoursWorked,
              status: newState.status,
              isOnBreak: newState.isOnBreak,
              currentBreakDuration: newState.currentBreakDuration,
              breakType: newState.breakType,
              timestamp: Date.now()
            };
            localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
          } catch (e) {
            console.warn('Failed to auto-save to localStorage:', e);
          }
        }, 0);
        return newState;
      });
    } else {
      setAttendanceState(state);
      setLastUpdateSource('direct');
      // Auto-save to localStorage
      setTimeout(() => {
        try {
          const today = getTodayKey();
          const stateToSave = {
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
          };
          localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
        } catch (e) {
          console.warn('Failed to auto-save to localStorage:', e);
        }
      }, 0);
    }
  }, []);

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
