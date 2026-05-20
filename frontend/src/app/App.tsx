import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { initClientSessionSync } from './utils/clientSessionSync';
import { CurrencyProvider } from './context/CurrencyContext';
import { AttendanceProvider } from '../context/AttendanceContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { Toaster } from './components/ui/sonner';
import './styles/animations.css';

// WorkPlus Pro - Version 1.0.1 (UI Refresh)
export default function App() {
  useEffect(() => {
    initClientSessionSync();
  }, []);

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
            <AttendanceProvider>
              <RouterProvider router={router} />
              <Toaster richColors closeButton position="top-right" />
            </AttendanceProvider>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
