import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { AttendanceProvider } from '../context/AttendanceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/animations.css';

// WorkPlus Pro - Version 1.0.1 (UI Refresh)
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
            <AttendanceProvider>
              <RouterProvider router={router} />
            </AttendanceProvider>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
