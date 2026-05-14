import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import EmployeeHolidayCalendar from '../../components/EmployeeHolidayCalendar';

const EmployeeHolidayCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string>('system');

  useEffect(() => {
    // Get the user's organization ID from auth context
    if (user?.orgId) {
      setOrgId(user.orgId);
    }
  }, [user]);

  return (
    <div className="p-6">
      <EmployeeHolidayCalendar organizationId={orgId} />
    </div>
  );
};

export default EmployeeHolidayCalendarPage;
