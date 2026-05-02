import React from 'react';
import EmployeeHolidayCalendar from '../../components/EmployeeHolidayCalendar';

const EmployeeHolidayCalendarPage: React.FC = () => {
  return (
    <div className="p-6">
      <EmployeeHolidayCalendar organizationId="ORG-001" />
    </div>
  );
};

export default EmployeeHolidayCalendarPage;
