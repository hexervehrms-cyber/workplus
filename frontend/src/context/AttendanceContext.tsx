import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface AttendanceState {
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursWorked: number;
  status: string;
  isOnBreak: boolean;
  isInMeeting: boolean;
  currentBreakDuration: number;
  breakType: string;
}

interface AttendanceContextType {
  attendance: AttendanceState;
  setAttendance: (state: AttendanceState | ((prev: AttendanceState) => AttendanceState)) => void;
  updateAttendance: (updates: Partial<AttendanceState>) => void;
  resetAttendance: () => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

const defaultState: AttendanceState = {
  isCheckedIn: false,
  checkInTime: null,
  checkOutTime: null,
  hoursWorked: 0,
  status: 'absent',
  isOnBreak: false,
  isInMeeting: false,
  currentBreakDuration: 0,
  breakType: 'regular'
};

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [attendance, setAttendanceState] = useState<AttendanceState>(defaultState);

  // Get today's date string for localStorage key
  const getTodayKey = () => new Date().toDateString();

  // Load from localStorage
  const loadFromLocalStorage = useCallback(() => {
    try {
      const today = getTodayKey();
      const cached = localStorage.getItem(`checkedIn_${today}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log('📦 [ATTENDANCE-CONTEXT] Loaded from localStorage:', parsed);
        setAttendanceState({
          isCheckedIn: parsed.checkedIn || parsed.isCheckedIn || false,
          checkInTime: parsed.checkInTime || null,
          checkOutTime: parsed.checkOutTime || null,
          hoursWorked: parsed.currentHours || parsed.hoursWorked || 0,
          status: parsed.status || 'absent',
          isOnBreak: parsed.isOnBreak || false,
          isInMeeting: parsed.isInMeeting || false,
          currentBreakDuration: parsed.currentBreakDuration || 0,
          breakType: parsed.breakType || 'regular'
        });
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }, []);

  // Save to localStorage
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
        isInMeeting: attendance.isInMeeting,
        currentBreakDuration: attendance.currentBreakDuration,
        breakType: attendance.breakType
      };
      localStorage.setItem(`checkedIn_${today}`, JSON.stringify(stateToSave));
      console.log('💾 [ATTENDANCE-CONTEXT] Saved to localStorage:', stateToSave);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [attendance]);

  // Update specific fields
  const updateAttendance = useCallback((updates: Partial<AttendanceState>) => {
    console.log('🔄 [ATTENDANCE-CONTEXT] Updating attendance:', updates);
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
            isInMeeting: newState.isInMeeting,
            currentBreakDuration: newState.currentBreakDuration,
            breakType: newState.breakType
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
              isInMeeting: newState.isInMeeting,
              currentBreakDuration: newState.currentBreakDuration,
              breakType: newState.breakType
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
            isInMeeting: state.isInMeeting,
            currentBreakDuration: state.currentBreakDuration,
            breakType: state.breakType
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
        saveToLocalStorage
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
