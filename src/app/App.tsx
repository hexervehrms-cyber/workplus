import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
          <RouterProvider router={router} />
          <Toaster />
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
