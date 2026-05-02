import React from 'react';
import CompanyDocs from '../../components/CompanyDocs';

const EmployeeCompanyDocs: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Company Documents</h1>
        <p className="text-muted-foreground">Access company policies, handbooks, and resources</p>
      </div>
      
      <CompanyDocs />
    </div>
  );
};

export default EmployeeCompanyDocs;
