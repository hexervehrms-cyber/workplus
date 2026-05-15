import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';
import { cn } from '../components/ui/utils';

function PageLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8" role="status" aria-label="Loading page">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

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
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoadingFallback />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
