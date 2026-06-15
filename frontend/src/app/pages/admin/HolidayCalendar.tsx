import React from 'react';
import { useAuth } from '../../context/AuthContext';
import HolidayCalendar from '../../components/HolidayCalendar';
import { resolveAuthOrgId } from '../../utils/apiHelper';

const AdminHolidayCalendar: React.FC = () => {
  const { user } = useAuth();
  const orgId = resolveAuthOrgId(user);

  if (!orgId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Organization context is required to load holidays.
      </div>
    );
  }

  return (
    <div className="p-6">
      <HolidayCalendar isAdmin={true} organizationId={orgId} />
    </div>
  );
};

export default AdminHolidayCalendar;
