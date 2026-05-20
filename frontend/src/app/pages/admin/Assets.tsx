import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import {
  Package, Plus, Search, Edit, Trash2, Loader2, X, 
  ArrowRight, Calendar, DollarSign, Laptop, MapPin, User,
  Upload, Image as ImageIcon, Star, Trash, ChevronLeft, ChevronRight,
  Download, FileUp
} from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { apiGet, apiPost, apiPut, apiDelete, apiFetchBlob } from '../../utils/apiHelper';

interface Asset {
  _id: string;
  assetName: string;
  assetType: string;
  category: string;
  specifications: {
    model?: string;
    serialNumber?: string;
    brand?: string;
  };
  financial: {
    purchasePrice?: number;
    currentValue?: number;
    purchaseDate?: string;
  };
  assignment: {
    assignedTo?: {
      _id: string;
      userId: { name: string };
      designation: string;
    };
    assignmentDate?: string;
    location?: {
      office?: string;
      desk?: string;
    };
  };
  status: string;
  condition: string;
  photos?: Array<{ photoData?: string; isMainPhoto?: boolean }>;
}

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [employees, setEmployees] = useState<any[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([]);
  const [assetPhotos, setAssetPhotos] = useState<any[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoDescriptions, setPhotoDescriptions] = useState<{ [key: number]: string }>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');

  // Import/Export functions
  const handleExportCSV = async () => {
    try {
      const blob = await apiFetchBlob('assets/export/csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Assets exported successfully');
    } catch (error) {
      console.error('Error exporting assets:', error);
      toast.error('Failed to export assets');
    }
  };

  const handleExportJSON = async () => {
    try {
      const blob = await apiFetchBlob('assets/export/json');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Assets exported successfully');
    } catch (error) {
      console.error('Error exporting assets:', error);
      toast.error('Failed to export assets');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
  };

  const handleImportAssets = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    try {
      setSubmitting(true);
      const fileContent = await importFile.text();

      let endpoint = '/assets/import/csv';
      let body: any = { csvData: fileContent };

      if (importFormat === 'json') {
        endpoint = '/assets/import/json';
        body = { assets: JSON.parse(fileContent) };
      }

      const data = await apiPost(endpoint, body);
      
      toast.success(`${data.data.summary.successful} asset(s) imported successfully`);
      
      if (data.data.errors.length > 0) {
        toast.warning(`${data.data.errors.length} row(s) had errors`);
      }

      setImportFile(null);
      setShowImportModal(false);
      fetchAssets();
    } catch (error) {
      console.error('Error importing assets:', error);
      toast.error('Failed to import assets');
    } finally {
      setSubmitting(false);
    }
  };

  const [formData, setFormData] = useState({
    assetName: '',
    assetType: 'laptop',
    category: 'IT_Equipment',
    model: '',
    serialNumber: '',
    purchasePrice: '',
    currentValue: '',
    purchaseDate: ''
  });

  const [assignData, setAssignData] = useState({
    assignedToId: '',
    location: '',
    reason: 'assignment'
  });

  const [returnData, setReturnData] = useState({
    condition: 'good',
    notes: '',
    returnedDate: new Date().toISOString().split('T')[0]
  });

  // Photo handling functions
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (uploadedPhotos.length + files.length > 10) {
      toast.error('Maximum 10 photos allowed per asset');
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoData = event.target?.result as string;
        setUploadedPhotos(prev => [...prev, {
          photoData,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          description: ''
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoDescription = (index: number, description: string) => {
    setPhotoDescriptions(prev => ({
      ...prev,
      [index]: description
    }));
  };

  const handleUploadPhotos = async () => {
    if (!selectedAsset || uploadedPhotos.length === 0) {
      toast.error('Please select photos to upload');
      return;
    }

    try {
      setSubmitting(true);

      const photosWithDescriptions = uploadedPhotos.map((photo, index) => ({
        ...photo,
        description: photoDescriptions[index] || ''
      }));

      await apiPost(`/assets/${selectedAsset._id}/photos`, { photos: photosWithDescriptions });
      toast.success(`${uploadedPhotos.length} photo(s) uploaded successfully`);
      setUploadedPhotos([]);
      setPhotoDescriptions({});
      
      // Refresh asset photos
      await fetchAssetPhotos(selectedAsset._id);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Failed to upload photos');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchAssetPhotos = async (assetId: string) => {
    try {
      const data = await apiGet(`/assets/${assetId}/photos`);
      setAssetPhotos(data.data.photos || []);
      setCurrentPhotoIndex(0);
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedAsset) return;

    try {
      await apiDelete(`/assets/${selectedAsset._id}/photos/${photoId}`);
      toast.success('Photo deleted successfully');
      await fetchAssetPhotos(selectedAsset._id);
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const handleSetMainPhoto = async (photoId: string) => {
    if (!selectedAsset) return;

    try {
      await apiPut(`/assets/${selectedAsset._id}/photos/${photoId}/set-main`, {});
      toast.success('Main photo updated');
      await fetchAssetPhotos(selectedAsset._id);
    } catch (error) {
      console.error('Error setting main photo:', error);
      toast.error('Failed to set main photo');
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchEmployees();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const data = await apiGet<{ data?: { assets?: Asset[] } }>('assets', false);
      setAssets(data?.data?.assets || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await apiGet<{ data?: { employees?: unknown[] } }>('employees', false);
      setEmployees((data?.data?.employees || []) as typeof employees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      const data = await apiPost<{ data?: Asset }>('assets', {
        assetName: formData.assetName,
        assetType: formData.assetType,
        category: formData.category,
        specifications: {
          model: formData.model,
          serialNumber: formData.serialNumber,
        },
        financial: {
          purchasePrice: parseFloat(formData.purchasePrice) || 0,
          currentValue:
            parseFloat(formData.currentValue) || parseFloat(formData.purchasePrice) || 0,
          purchaseDate: formData.purchaseDate,
        },
      });

      const newAsset = data?.data;
      if (!newAsset) throw new Error('Failed to create asset');

      // Upload photos if any
      if (uploadedPhotos.length > 0) {
        const photosWithDescriptions = uploadedPhotos.map((photo, index) => ({
          ...photo,
          description: photoDescriptions[index] || ''
        }));

        try {
          await apiPost(`assets/${newAsset._id}/photos`, {
            photos: photosWithDescriptions,
          });
        } catch (photoError) {
          console.error('Error uploading photos:', photoError);
          toast.warning('Asset created but photos upload failed');
        }
      }

      setAssets([newAsset, ...assets]);
      setFormData({
        assetName: '',
        assetType: 'laptop',
        category: 'IT_Equipment',
        model: '',
        serialNumber: '',
        purchasePrice: '',
        currentValue: '',
        purchaseDate: ''
      });
      setUploadedPhotos([]);
      setPhotoDescriptions({});
      setShowAddForm(false);
      toast.success('Asset created successfully');
    } catch (error) {
      console.error('Error creating asset:', error);
      toast.error('Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset || !assignData.assignedToId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiPut<{ data?: Asset }>(`assets/${selectedAsset._id}/assign`, {
        assignedToId: assignData.assignedToId,
        location: assignData.location,
        reason: assignData.reason,
      });

      setAssets(assets.map((a) => (a._id === selectedAsset._id ? (data?.data ?? a) : a)));
      setShowAssignForm(false);
      setSelectedAsset(null);
      setAssignData({ assignedToId: '', location: '', reason: 'assignment' });
      toast.success('Asset assigned successfully');
    } catch (error) {
      console.error('Error assigning asset:', error);
      toast.error('Failed to assign asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset) {
      toast.error('No asset selected');
      return;
    }

    try {
      setSubmitting(true);

      const data = await apiPut<{ data?: Asset }>(`assets/${selectedAsset._id}/return`, {
        condition: returnData.condition,
        notes: returnData.notes,
        returnedDate: returnData.returnedDate,
      });

      setAssets(assets.map((a) => (a._id === selectedAsset._id ? (data?.data ?? a) : a)));
      setShowReturnForm(false);
      setSelectedAsset(null);
      setReturnData({ condition: 'good', notes: '', returnedDate: new Date().toISOString().split('T')[0] });
      toast.success('Asset returned successfully');
    } catch (error) {
      console.error('Error returning asset:', error);
      toast.error('Failed to return asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      await apiDelete(`assets/${assetId}`);

      setAssets(assets.filter(a => a._id !== assetId));
      toast.success('Asset deleted successfully');
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.specifications?.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.specifications?.model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Asset Management</h1>
          <p className="text-muted-foreground mt-1">Manage company assets and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleExportJSON} variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button onClick={() => setShowImportModal(true)} variant="outline" className="rounded-xl">
            <FileUp className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setShowAddForm(true)} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, serial number, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_use">In Use</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.map((asset) => (
          <Card key={asset._id} className="p-4 rounded-xl hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              {/* Photo Thumbnail */}
              <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {asset.photos && asset.photos.length > 0 ? (
                  <img 
                    src={asset.photos.find((p: any) => p.isMainPhoto)?.photoData || asset.photos[0]?.photoData} 
                    alt={asset.assetName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                )}
              </div>

              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{asset.assetName}</h3>
                  <p className="text-sm text-muted-foreground">{asset.specifications?.model}</p>
                </div>
                <Badge variant={asset.status === 'assigned' ? 'default' : 'secondary'}>
                  {asset.status}
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Serial:</span>
                  <span className="font-medium">{asset.specifications?.serialNumber || 'N/A'}</span>
                </div>

                {asset.assignment?.assignedTo && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned to:</span>
                    <span className="font-medium">{asset.assignment.assignedTo.userId.name}</span>
                  </div>
                )}

                {asset.financial?.currentValue && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Current Value:</span>
                    <span className="font-medium">₹{asset.financial.currentValue.toLocaleString()}</span>
                  </div>
                )}

                {asset.assignment?.assignmentDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="font-medium">{new Date(asset.assignment.assignmentDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedAsset(asset);
                    fetchAssetPhotos(asset._id);
                    setShowPhotoGallery(true);
                  }}
                  className="flex-1 rounded-lg"
                >
                  <ImageIcon className="w-4 h-4 mr-1" />
                  Photos
                </Button>
                {asset.status === 'available' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAsset(asset);
                      setShowAssignForm(true);
                    }}
                    className="flex-1 rounded-lg"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Assign
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAsset(asset);
                      setShowReturnForm(true);
                    }}
                    className="flex-1 rounded-lg"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Return
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteAsset(asset._id)}
                  className="rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Asset Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Asset</h2>
                <button onClick={() => setShowAddForm(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddAsset} className="space-y-4">
                <div>
                  <Label>Asset Name *</Label>
                  <Input
                    value={formData.assetName}
                    onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                    placeholder="e.g., Dell Laptop"
                    className="mt-1 rounded-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type *</Label>
                    <Select value={formData.assetType} onValueChange={(value) => setFormData({ ...formData, assetType: value })}>
                      <SelectTrigger className="mt-1 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="laptop">Laptop</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="monitor">Monitor</SelectItem>
                        <SelectItem value="mobile_phone">Mobile Phone</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="printer">Printer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger className="mt-1 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IT_Equipment">IT Equipment</SelectItem>
                        <SelectItem value="Office_Furniture">Office Furniture</SelectItem>
                        <SelectItem value="Vehicle">Vehicle</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Model</Label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., XPS 13"
                    className="mt-1 rounded-lg"
                  />
                </div>

                <div>
                  <Label>Serial Number</Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="e.g., SN123456"
                    className="mt-1 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Purchase Price</Label>
                    <Input
                      type="number"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                      placeholder="0"
                      className="mt-1 rounded-lg"
                    />
                  </div>

                  <div>
                    <Label>Purchase Date</Label>
                    <Input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="mt-1 rounded-lg"
                    />
                  </div>
                </div>

                {/* Photo Upload Section */}
                <div className="border-t pt-4">
                  <Label className="mb-2 block">Asset Photos (Optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="photo-input"
                    />
                    <label htmlFor="photo-input" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">Max 10 photos per asset</p>
                    </label>
                  </div>

                  {/* Uploaded Photos Preview */}
                  {uploadedPhotos.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium">Uploaded Photos ({uploadedPhotos.length}/10)</p>
                      {uploadedPhotos.map((photo, index) => (
                        <div key={index} className="flex gap-2 items-start p-2 bg-muted rounded-lg">
                          <img 
                            src={photo.photoData} 
                            alt={`Preview ${index + 1}`}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{photo.fileName}</p>
                            <input
                              type="text"
                              placeholder="Photo description (optional)"
                              value={photoDescriptions[index] || ''}
                              onChange={(e) => handlePhotoDescription(index, e.target.value)}
                              className="w-full text-xs mt-1 px-2 py-1 border rounded bg-background"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Asset
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Assign Asset Modal */}
      {showAssignForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Assign Asset</h2>
                <button onClick={() => setShowAssignForm(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignAsset} className="space-y-4">
                <div>
                  <Label>Asset: {selectedAsset.assetName}</Label>
                  <p className="text-sm text-muted-foreground mt-1">Serial: {selectedAsset.specifications?.serialNumber}</p>
                </div>

                <div>
                  <Label>Assign To *</Label>
                  <Select value={assignData.assignedToId} onValueChange={(value) => setAssignData({ ...assignData, assignedToId: value })}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {emp.userId?.name} - {emp.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Location</Label>
                  <Input
                    value={assignData.location}
                    onChange={(e) => setAssignData({ ...assignData, location: e.target.value })}
                    placeholder="e.g., Desk 5, Floor 2"
                    className="mt-1 rounded-lg"
                  />
                </div>

                <div>
                  <Label>Reason</Label>
                  <Select value={assignData.reason} onValueChange={(value) => setAssignData({ ...assignData, reason: value })}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_hire">New Hire</SelectItem>
                      <SelectItem value="replacement">Replacement</SelectItem>
                      <SelectItem value="upgrade">Upgrade</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                      <SelectItem value="project_based">Project Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAssignForm(false)}
                    className="flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Assign
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Return Asset Modal */}
      {showReturnForm && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Return Asset</h2>
                <button onClick={() => setShowReturnForm(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReturnAsset} className="space-y-4">
                <div>
                  <Label>Asset: {selectedAsset.assetName}</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Assigned to: {selectedAsset.assignment?.assignedTo?.userId.name}
                  </p>
                </div>

                <div>
                  <Label>Return Date *</Label>
                  <Input
                    type="date"
                    value={returnData.returnedDate}
                    onChange={(e) => setReturnData({ ...returnData, returnedDate: e.target.value })}
                    className="mt-1 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <Label>Condition *</Label>
                  <Select value={returnData.condition} onValueChange={(value) => setReturnData({ ...returnData, condition: value })}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={returnData.notes}
                    onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                    placeholder="Any notes about the asset condition or return..."
                    className="mt-1 rounded-lg"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReturnForm(false)}
                    className="flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Return Asset
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {showPhotoGallery && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Asset Photos - {selectedAsset.assetName}</h2>
                <button onClick={() => setShowPhotoGallery(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {assetPhotos.length === 0 ? (
                <div className="text-center py-8">
                  <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No photos uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Photo Viewer */}
                  <div className="relative bg-muted rounded-lg overflow-hidden">
                    <img 
                      src={assetPhotos[currentPhotoIndex]?.photoData} 
                      alt={`Asset photo ${currentPhotoIndex + 1}`}
                      className="w-full h-96 object-contain"
                    />
                    {assetPhotos.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentPhotoIndex(prev => (prev - 1 + assetPhotos.length) % assetPhotos.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setCurrentPhotoIndex(prev => (prev + 1) % assetPhotos.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Photo Info */}
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium">Photo {currentPhotoIndex + 1} of {assetPhotos.length}</p>
                    {assetPhotos[currentPhotoIndex]?.description && (
                      <p className="text-sm text-muted-foreground mt-1">{assetPhotos[currentPhotoIndex].description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploaded: {new Date(assetPhotos[currentPhotoIndex]?.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Photo Actions */}
                  <div className="flex gap-2">
                    {!assetPhotos[currentPhotoIndex]?.isMainPhoto && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetMainPhoto(assetPhotos[currentPhotoIndex]._id)}
                        className="flex-1 rounded-lg"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        Set as Main
                      </Button>
                    )}
                    {assetPhotos[currentPhotoIndex]?.isMainPhoto && (
                      <div className="flex-1 flex items-center justify-center bg-primary/10 rounded-lg">
                        <Star className="w-4 h-4 mr-1 fill-primary text-primary" />
                        <span className="text-sm font-medium">Main Photo</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeletePhoto(assetPhotos[currentPhotoIndex]._id)}
                      className="rounded-lg"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Thumbnails */}
                  {assetPhotos.length > 1 && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2">All Photos</p>
                      <div className="grid grid-cols-6 gap-2">
                        {assetPhotos.map((photo, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentPhotoIndex(index)}
                            className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                              currentPhotoIndex === index ? 'border-primary' : 'border-border'
                            }`}
                          >
                            <img 
                              src={photo.photoData} 
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-16 object-cover"
                            />
                            {photo.isMainPhoto && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload More Photos */}
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Add More Photos</p>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          handlePhotoSelect(e);
                          // After selecting, show upload button
                        }}
                        className="hidden"
                        id="gallery-photo-input"
                      />
                      <label htmlFor="gallery-photo-input" className="cursor-pointer">
                        <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm text-muted-foreground">Click to upload more photos</p>
                      </label>
                    </div>

                    {uploadedPhotos.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium">New Photos ({uploadedPhotos.length})</p>
                        {uploadedPhotos.map((photo, index) => (
                          <div key={index} className="flex gap-2 items-start p-2 bg-muted rounded-lg">
                            <img 
                              src={photo.photoData} 
                              alt={`Preview ${index + 1}`}
                              className="w-10 h-10 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{photo.fileName}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(index)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <Button
                          onClick={handleUploadPhotos}
                          disabled={submitting}
                          className="w-full rounded-lg mt-2"
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Upload {uploadedPhotos.length} Photo(s)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowPhotoGallery(false)}
                  className="flex-1 rounded-lg"
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Import Assets</h2>
                <button onClick={() => setShowImportModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Import Format</Label>
                  <Select value={importFormat} onValueChange={(value: any) => setImportFormat(value)}>
                    <SelectTrigger className="mt-1 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV File</SelectItem>
                      <SelectItem value="json">JSON File</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Select File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors mt-1">
                    <input
                      type="file"
                      accept={importFormat === 'csv' ? '.csv' : '.json'}
                      onChange={handleImportFile}
                      className="hidden"
                      id="import-file-input"
                    />
                    <label htmlFor="import-file-input" className="cursor-pointer">
                      <FileUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Click to select {importFormat.toUpperCase()} file</p>
                      {importFile && (
                        <p className="text-sm font-medium text-primary mt-2">{importFile.name}</p>
                      )}
                    </label>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Format Requirements:</strong>
                    {importFormat === 'csv' ? (
                      <span> CSV must include headers: Asset Name, Asset Type, Category, Model, Serial Number, Brand, Purchase Price, Current Value, Purchase Date, Status, Condition, Assigned To, Assignment Date, Location, Vendor, Invoice Number</span>
                    ) : (
                      <span> JSON must be an array of objects with fields: assetName, assetType, category, specifications, financial, status, condition</span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowImportModal(false)}
                    className="flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleImportAssets}
                    disabled={!importFile || submitting}
                    className="flex-1 rounded-lg"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Import
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}


