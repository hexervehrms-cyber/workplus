import React from 'react';
import HolidayCalendar from '../../components/HolidayCalendar';

const AdminHolidayCalendar: React.FC = () => {
  return (
    <div className="p-6">
      <HolidayCalendar isAdmin={true} organizationId="ORG-001" />
    </div>
  );
};

export default AdminHolidayCalendar;
