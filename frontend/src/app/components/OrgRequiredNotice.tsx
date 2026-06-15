import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { resolveAuthOrgId } from '../utils/apiHelper';

type AuthUser = {
  role?: string;
  orgId?: string;
  tenantId?: string;
} | null | undefined;

export function OrgRequiredNotice({ user }: { user: AuthUser }) {
  const orgId = resolveAuthOrgId(user);
  if (orgId || user?.role === 'super_admin') return null;

  return (
    <Card className="mb-6 border-destructive/30 bg-destructive/5 p-4">
      <div className="flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Organization context required</p>
          <p className="text-sm text-muted-foreground">
            Your session is missing a valid organization. Sign out and sign in again so payroll, announcements,
            chat, and settings can load correctly.
          </p>
          <Button type="button" variant="outline" size="sm" className="rounded-lg" asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
