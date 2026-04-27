import React from 'react';
import CompanyDocs from '../../components/CompanyDocs';

const AdminCompanyDocs: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Company Documents</h1>
        <p className="text-muted-foreground">Manage company-wide documents and resources</p>
      </div>
      
      <CompanyDocs isAdmin={true} />
    </div>
  );
};

export default AdminCompanyDocs;
