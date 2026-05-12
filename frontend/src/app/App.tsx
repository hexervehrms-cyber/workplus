import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { AttendanceProvider } from '../context/AttendanceContext';
import { Toaster } from './components/ui/sonner';
import './styles/animations.css';

// WorkPlus Pro - Version 1.0.1 (UI Refresh)
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          <AttendanceProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AttendanceProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
