import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, Package, Laptop, DollarSign, Calendar, MapPin, User, Image as ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { apiGet } from '../../utils/apiHelper';

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
  const [totalValue, setTotalValue] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetPhotos, setAssetPhotos] = useState<any[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);

      const userData = await apiGet<{
        success?: boolean;
        data?: { employeeId?: string; userId?: string; id?: string };
      }>('auth/me', false);
      const employeeId =
        userData?.data?.employeeId ||
        (await apiGet<{ data?: { _id?: string } }>(
          `employees/user/${userData?.data?.userId || userData?.data?.id || ''}`,
          false
        ))?.data?._id;
      if (!employeeId) {
        throw new Error('Employee profile not found');
      }

      const data = await apiGet<{
        data?: { assets?: Asset[]; totalValue?: number };
      }>(`assets/employee/${employeeId}`, false);
      setAssets(data?.data?.assets || []);
      setTotalValue(data?.data?.totalValue || 0);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load your assets'
      );
      setAssets([]);
      setTotalValue(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetPhotos = async (assetId: string) => {
    try {
      const data = await apiGet<{ data?: { photos?: unknown[] } }>(
        `assets/${assetId}/photos`,
        false
      );
      setAssetPhotos(data?.data?.photos || []);
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
        <p className="text-sm text-muted-foreground">
          Contact HR to request new asset assignments
        </p>
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
    </div>
  );
}
