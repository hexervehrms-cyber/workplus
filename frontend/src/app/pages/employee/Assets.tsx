import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Package, Laptop, DollarSign, Calendar, MapPin, User, Image as ImageIcon, X, ChevronLeft, ChevronRight, Plus, Upload } from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { getBearerToken } from '../../utils/apiHelper';

interface Asset {
  _id: string;
  assetName: string;
  assetType: string;
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
    assignedBy?: {
      name: string;
      email: string;
    };
    assignmentDate?: string;
    location?: {
      office?: string;
      desk?: string;
    };
  };
  status: string;
  condition: string;
  photos?: Array<{
    photoData?: string;
    isMainPhoto?: boolean;
  }>;
}

export default function EmployeeAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetPhotos, setAssetPhotos] = useState<any[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

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

  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([]);
  const [photoDescriptions, setPhotoDescriptions] = useState<{ [key: number]: string }>({});

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

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      // Validate form data
      if (!formData.assetName.trim()) {
        toast.error('Asset name is required');
        setSubmitting(false);
        return;
      }

      if (!formData.assetType) {
        toast.error('Asset type is required');
        setSubmitting(false);
        return;
      }

      if (!formData.category) {
        toast.error('Category is required');
        setSubmitting(false);
        return;
      }

      const token = getBearerToken() || '';
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        setSubmitting(false);
        return;
      }

      const assetPayload = {
        assetName: formData.assetName.trim(),
        assetType: formData.assetType,
        category: formData.category,
        specifications: {
          model: formData.model.trim(),
          serialNumber: formData.serialNumber.trim()
        },
        financial: {
          purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : 0,
          currentValue: formData.currentValue ? parseFloat(formData.currentValue) : (formData.purchasePrice ? parseFloat(formData.purchasePrice) : 0),
          purchaseDate: formData.purchaseDate || null
        }
      };

      console.log('Creating asset with payload:', assetPayload);
      console.log('Using token:', token ? 'Found' : 'Not found');

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(assetPayload)
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to create asset');
      }

      const newAsset = responseData.data;
      console.log('Asset created:', newAsset);

      // Upload photos if any
      if (uploadedPhotos.length > 0) {
        const photosWithDescriptions = uploadedPhotos.map((photo, index) => ({
          ...photo,
          description: photoDescriptions[index] || ''
        }));

        try {
          console.log('Uploading photos...');
          const photoResponse = await fetch(`/api/assets/${newAsset._id}/photos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ photos: photosWithDescriptions })
          });

          const photoData = await photoResponse.json();
          console.log('Photo upload response:', photoData);

          if (!photoResponse.ok) {
            console.error('Photo upload failed:', photoData);
            toast.warning('Asset created but photos upload failed');
          } else {
            console.log('Photos uploaded successfully');
          }
        } catch (photoError) {
          console.error('Error uploading photos:', photoError);
          toast.warning('Asset created but photos upload failed');
        }
      }

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
      
      // Refresh assets list
      await fetchAssets();
    } catch (error) {
      console.error('Error creating asset:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create asset';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);

      // Get current user's employee ID
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${getBearerToken() || ''}`
        }
      });

      if (!userResponse.ok) throw new Error('Failed to get user info');

      const userData = await userResponse.json();
      const userId = userData.data.id;

      // Fetch employee record to get employeeId
      const employeeResponse = await fetch(`/api/employees?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${getBearerToken() || ''}`
        }
      });

      let employeeId = userId;
      if (employeeResponse.ok) {
        const employeeData = await employeeResponse.json();
        employeeId = employeeData.data?.[0]?._id || userId;
      }

      // Fetch assets for this employee
      const response = await fetch(`/api/assets/employee/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${getBearerToken() || ''}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch assets');

      const data = await response.json();
      setAssets(data.data.assets || []);
      setTotalValue(data.data.totalValue || 0);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetPhotos = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}/photos`, {
        headers: {
          'Authorization': `Bearer ${getBearerToken() || ''}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch photos');

      const data = await response.json();
      setAssetPhotos(data.data.photos || []);
      setCurrentPhotoIndex(0);
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

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
          <h1 className="text-3xl font-bold text-foreground">My Assets</h1>
          <p className="text-muted-foreground mt-1">Assets assigned to you</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-muted-foreground text-sm">Total Assets</p>
            <p className="text-3xl font-bold text-foreground mt-2">{assets.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Total Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">₹{totalValue.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Assets List */}
      {assets.length === 0 ? (
        <Card className="p-12 rounded-xl text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No assets assigned to you yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
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
                  <Badge variant="default" className="bg-green-600">
                    {asset.condition}
                  </Badge>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Serial Number:</span>
                    <span className="font-medium">{asset.specifications?.serialNumber || 'N/A'}</span>
                  </div>

                  {asset.financial?.currentValue && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Current Value:</span>
                      <span className="font-medium">₹{asset.financial.currentValue.toLocaleString()}</span>
                    </div>
                  )}

                  {asset.financial?.purchasePrice && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Purchase Price:</span>
                      <span className="font-medium">₹{asset.financial.purchasePrice.toLocaleString()}</span>
                    </div>
                  )}

                  {asset.assignment?.assignmentDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Assigned:</span>
                      <span className="font-medium">{new Date(asset.assignment.assignmentDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {asset.assignment?.location?.desk && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">{asset.assignment.location.desk}</span>
                    </div>
                  )}

                  {asset.assignment?.assignedBy && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Assigned By:</span>
                      <span className="font-medium">{asset.assignment.assignedBy.name}</span>
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
                  {/* Type Badge */}
                  <Badge variant="secondary" className="text-xs">
                    {asset.assetType}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
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
                  <p className="text-muted-foreground">No photos available for this asset</p>
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
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

      {/* Add Asset Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md rounded-xl max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}
