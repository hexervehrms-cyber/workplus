import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import HolidayCalendar from '../../components/HolidayCalendar';

const AdminHolidayCalendar: React.FC = () => {
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
      <HolidayCalendar isAdmin={true} organizationId={orgId} />
    </div>
  );
};

export default AdminHolidayCalendar;
