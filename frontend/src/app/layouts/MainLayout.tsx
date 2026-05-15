import { Outlet, useLocation } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { cn } from '../components/ui/utils';

export function MainLayout() {
  const location = useLocation();
  const isChatRoute = /\/chat\/?$/.test(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Navbar />
        <main
          className={cn(
            'flex-1 min-h-0',
            isChatRoute ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
