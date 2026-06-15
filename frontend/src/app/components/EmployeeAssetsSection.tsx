import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Loader2, Package, Laptop, DollarSign, Calendar, MapPin, Plus } from 'lucide-react';
import { apiGet } from '../utils/apiHelper';

interface Asset {
  _id: string;
  assetName: string;
  assetType: string;
  specifications: {
    model?: string;
    serialNumber?: string;
  };
  financial: {
    purchasePrice?: number;
    currentValue?: number;
  };
  assignment: {
    assignmentDate?: string;
    location?: {
      desk?: string;
    };
  };
  condition: string;
}

interface EmployeeAssetsSectionProps {
  employeeId: string;
  isAdmin?: boolean;
  onAssignClick?: () => void;
}

export default function EmployeeAssetsSection({ employeeId, isAdmin = false, onAssignClick }: EmployeeAssetsSectionProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    fetchAssets();
  }, [employeeId]);

  const fetchAssets = async () => {
    try {
      setLoading(true);

      const data = await apiGet<{
        data?: { assets?: Asset[]; totalValue?: number };
      }>(`assets/employee/${employeeId}`, false);
      setAssets(data?.data?.assets || []);
      setTotalValue(data?.data?.totalValue || 0);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-xl">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Assigned Assets</h3>
          </div>
          {isAdmin && onAssignClick && (
            <Button size="sm" onClick={onAssignClick} className="rounded-lg">
              <Plus className="w-4 h-4 mr-1" />
              Assign Asset
            </Button>
          )}
        </div>

        {/* Summary */}
        {assets.length > 0 && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Assets</p>
              <p className="text-2xl font-bold text-foreground">{assets.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-foreground">₹{totalValue.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Assets List */}
        {assets.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No assets assigned</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => (
              <div key={asset._id} className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-foreground">{asset.assetName}</p>
                    <p className="text-sm text-muted-foreground">{asset.specifications?.model}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {asset.condition}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">SN:</span>
                    <span className="font-medium">{asset.specifications?.serialNumber || 'N/A'}</span>
                  </div>

                  {asset.financial?.currentValue && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">₹{asset.financial.currentValue.toLocaleString()}</span>
                    </div>
                  )}

                  {asset.assignment?.assignmentDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{new Date(asset.assignment.assignmentDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {asset.assignment?.location?.desk && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{asset.assignment.location.desk}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
