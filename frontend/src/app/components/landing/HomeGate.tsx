import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../utils/rolePaths';
import { hasStoredSessionHint } from '../../utils/publicPaths';
import { LandingShell } from './LandingShell';

const LandingPage = lazy(() => import('../../pages/LandingPage'));

export default function HomeGate() {
  const { user, loading } = useAuth();

  if (user?.role) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  if (loading && hasStoredSessionHint()) {
    return <LandingShell />;
  }

  return (
    <Suspense fallback={<LandingShell />}>
      <LandingPage />
    </Suspense>
  );
}
