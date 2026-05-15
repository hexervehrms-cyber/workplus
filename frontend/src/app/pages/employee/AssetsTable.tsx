import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Package, Plus, Search, Loader2, Eye, ChevronUp, ChevronDown, X
} from 'lucide-react';
import { toast } from 'sonner';
import { getBearerToken } from '../../utils/apiHelper';

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
  createdAt?: string;
}

export default function EmployeeAssetsTable() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'cost'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [totalValue, setTotalValue] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);

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

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);

      // Validate form data
      if (!formData.assetName.trim()) {
        toast.error('Asset name is required');
        return;
      }

      if (!formData.assetType) {
        toast.error('Asset type is required');
        return;
      }

      if (!formData.category) {
        toast.error('Category is required');
        return;
      }

      const token = getBearerToken() || '';
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
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

      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(assetPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create asset');
      }

      const responseData = await response.json();
      const newAsset = responseData.data;

      // Add new asset to list
      setAssets(prev => [newAsset, ...prev]);
      
      // Reset form
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

      setShowAddForm(false);
      toast.success('Asset created successfully');
    } catch (err: any) {
      console.error('Error creating asset:', err);
      toast.error(err.message || 'Failed to create asset');
    } finally {
      setSubmitting(false);
    }
  };

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
      toast.error('Failed to load your assets');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets
    .filter(asset => {
      const matchesSearch = 
        asset.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.specifications?.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.specifications?.model?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      if (sortBy === 'date') {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        compareValue = dateA - dateB;
      } else if (sortBy === 'name') {
        compareValue = a.assetName.localeCompare(b.assetName);
      } else if (sortBy === 'cost') {
        compareValue = (a.financial?.purchasePrice || 0) - (b.financial?.purchasePrice || 0);
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent':
        return 'bg-green-50 text-green-700';
      case 'good':
        return 'bg-blue-50 text-blue-700';
      case 'fair':
        return 'bg-yellow-50 text-yellow-700';
      case 'poor':
        return 'bg-orange-50 text-orange-700';
      case 'damaged':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
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
      {/* Add Asset Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New Asset</h2>
              <Button variant="ghost" onClick={() => setShowAddForm(false)} disabled={submitting}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <Label>Asset Name *</Label>
                <Input
                  value={formData.assetName}
                  onChange={(e) => setFormData({...formData, assetName: e.target.value})}
                  placeholder="e.g., MacBook Pro"
                  className="mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset Type *</Label>
                  <Select value={formData.assetType} onValueChange={(value) => setFormData({...formData, assetType: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="monitor">Monitor</SelectItem>
                      <SelectItem value="keyboard">Keyboard</SelectItem>
                      <SelectItem value="mouse">Mouse</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT_Equipment">IT Equipment</SelectItem>
                      <SelectItem value="Office_Furniture">Office Furniture</SelectItem>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Model</Label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    placeholder="e.g., M1 Pro"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Serial Number</Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
                    placeholder="e.g., SN123456"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Purchase Price</Label>
                  <Input
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({...formData, purchasePrice: e.target.value})}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Current Value</Label>
                  <Input
                    type="number"
                    value={formData.currentValue}
                    onChange={(e) => setFormData({...formData, currentValue: e.target.value})}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Asset
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Assets</h1>
          <p className="text-muted-foreground mt-1">Assets assigned to you</p>
        </div>
        <Button className="rounded-lg" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, model, or serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Sort By</label>
            <div className="flex gap-2 mt-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="cost">Cost</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-border rounded-lg hover:bg-muted"
              >
                {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Asset Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Model Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Serial Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Assignee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Location</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Purchased Cost</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Current Cost</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Condition</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No assets found</p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-foreground">
                      {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {asset.assetName}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {asset.specifications?.model || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {asset.specifications?.serialNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {asset.assignment?.assignedBy?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      {asset.assignment?.location?.desk || asset.assignment?.location?.office || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      ₹{(asset.financial?.purchasePrice || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      ₹{(asset.financial?.currentValue || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge className={`${getConditionColor(asset.condition)} border-0`}>
                        {asset.condition}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => {}}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <Card className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold text-foreground mt-1">{assets.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Purchase Value</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ₹{assets.reduce((sum, a) => sum + (a.financial?.purchasePrice || 0), 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Current Value</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ₹{totalValue.toLocaleString()}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
