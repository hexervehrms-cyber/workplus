import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { 
  Download, Upload, FileJson, FileText, Loader2, X, CheckCircle, AlertCircle,
  Users, DollarSign, Package
} from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { apiPost, buildApiUrl } from '../../utils/apiHelper';
import { TokenManager } from '../../utils/api';

interface ExportStats {
  totalRecords: number;
  format: 'csv' | 'json';
  timestamp: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  recordsProcessed?: number;
  recordsSuccessful?: number;
  recordsFailed?: number;
  errors?: string[];
}

export default function BulkOperations() {
  const [activeTab, setActiveTab] = useState<'employees' | 'expenses' | 'assets'>('employees');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');

  const getBearer = () =>
    TokenManager.get();

  const handleExport = async (format: 'csv' | 'json') => {
    const token = getBearer();
    if (!token) {
      toast.error('Authentication token not found. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      const url = buildApiUrl(`admin/bulk/${activeTab}/export/${format}`);

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to export ${activeTab}`);
      }

      // Get the filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${activeTab}-${Date.now()}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`${activeTab} exported successfully as ${format.toUpperCase()}`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || `Failed to export ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['text/csv', 'application/json', 'text/plain'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid CSV or JSON file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    const token = getBearer();
    if (!token) {
      toast.error('Authentication token not found. Please log in again.');
      return;
    }

    try {
      setImporting(true);
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const endpoint = `admin/bulk/${activeTab}/import/${importFormat}`;

      const data = await apiPost(endpoint, formData);

      setImportResult({
        success: true,
        message: data.message || 'Import completed successfully',
        recordsProcessed: data.recordsProcessed,
        recordsSuccessful: data.recordsSuccessful,
        recordsFailed: data.recordsFailed,
        errors: data.errors
      });

      toast.success('Import completed successfully');
    } catch (error: any) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error.message || `Failed to import ${activeTab}`,
        errors: [error.message]
      });
      toast.error(error.message || `Failed to import ${activeTab}`);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setImportResult(null);
    setShowImportModal(false);
    setImportFormat('csv');
  };

  const getTabIcon = () => {
    switch (activeTab) {
      case 'employees':
        return <Users className="w-5 h-5" />;
      case 'expenses':
        return <DollarSign className="w-5 h-5" />;
      case 'assets':
        return <Package className="w-5 h-5" />;
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'employees':
        return 'Employees';
      case 'expenses':
        return 'Expenses';
      case 'assets':
        return 'Assets';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Bulk Operations</h1>
        <p className="text-muted-foreground">Import and export data in bulk</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['employees', 'expenses', 'assets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Section */}
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Export {getTabLabel()}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Download all {activeTab} data in your preferred format
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => handleExport('csv')}
              disabled={loading}
              className="w-full justify-start"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </>
              )}
            </Button>
            <Button
              onClick={() => handleExport('json')}
              disabled={loading}
              className="w-full justify-start"
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileJson className="w-4 h-4 mr-2" />
                  Export as JSON
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Tip:</strong> Use CSV for spreadsheet applications like Excel. Use JSON for data integration and backups.
            </p>
          </div>
        </Card>

        {/* Import Section */}
        <Card className="p-6 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Import {getTabLabel()}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Upload data to add or update {activeTab}
          </p>

          <Button
            onClick={() => setShowImportModal(true)}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose File to Import
          </Button>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-900">
              <strong>Note:</strong> Ensure your file matches the export format. Invalid records will be skipped.
            </p>
          </div>
        </Card>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Import {getTabLabel()}</h2>
              <Button variant="ghost" onClick={resetImport} disabled={importing}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <Label>File Format</Label>
                  <div className="flex gap-2 mt-2">
                    {(['csv', 'json'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={() => setImportFormat(format)}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 transition-colors ${
                          importFormat === format
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Select File</Label>
                  <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleImportFile}
                      className="hidden"
                      id="import-file"
                      disabled={importing}
                    />
                    <label htmlFor="import-file" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">
                        {selectedFile ? selectedFile.name : 'Click to select or drag and drop'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        CSV or JSON files up to 5MB
                      </p>
                    </label>
                  </div>
                </div>

                {selectedFile && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-900">
                      ✓ File selected: {selectedFile.name}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={resetImport}
                    className="flex-1"
                    disabled={importing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    className="flex-1"
                    disabled={!selectedFile || importing}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border-2 ${
                  importResult.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        importResult.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {importResult.message}
                      </p>
                      {importResult.recordsProcessed !== undefined && (
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            Records processed: {importResult.recordsProcessed}
                          </p>
                          {importResult.recordsSuccessful !== undefined && (
                            <p className="text-green-700">
                              ✓ Successful: {importResult.recordsSuccessful}
                            </p>
                          )}
                          {importResult.recordsFailed !== undefined && importResult.recordsFailed > 0 && (
                            <p className="text-red-700">
                              ✗ Failed: {importResult.recordsFailed}
                            </p>
                          )}
                        </div>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium">Errors:</p>
                          <ul className="text-xs space-y-1">
                            {importResult.errors.slice(0, 3).map((error, idx) => (
                              <li key={idx} className="text-red-700">• {error}</li>
                            ))}
                            {importResult.errors.length > 3 && (
                              <li className="text-red-700">• ... and {importResult.errors.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={resetImport}
                    className="flex-1"
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
