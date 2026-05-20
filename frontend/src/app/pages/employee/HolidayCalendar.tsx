import React from 'react';
import { useAuth } from '../../context/AuthContext';
import EmployeeHolidayCalendar from '../../components/EmployeeHolidayCalendar';
import { resolveAuthOrgId } from '../../utils/apiHelper';

const EmployeeHolidayCalendarPage: React.FC = () => {
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
      <EmployeeHolidayCalendar organizationId={orgId} />
    </div>
  );
};

export default EmployeeHolidayCalendarPage;
