import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Package, Plus, Search, Edit, Trash2, Loader2, X, 
  Download, FileUp, Eye, ChevronUp, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

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
      userId?: { name: string };
      designation?: string;
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

export default function AssetsTable() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'cost'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/assets', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch assets');

      const data = await response.json();
      setAssets(data.data.assets || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets');
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
      
      const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
      
      return matchesSearch && matchesStatus;
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

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/assets/export/csv', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to export assets');

      const blob = await response.blob();
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

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete asset');

      setAssets(assets.filter(a => a._id !== assetId));
      toast.success('Asset deleted successfully');
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'retired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assets Management</h1>
          <p className="text-muted-foreground mt-1">Manage all organizational assets</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="rounded-lg">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button className="rounded-lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="text-sm font-medium text-foreground">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Condition</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-muted-foreground">
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
                      {asset.assignment?.assignedTo?.userId?.name || 'Unassigned'}
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
                      <Badge className={`${getStatusColor(asset.status)} border-0`}>
                        {asset.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge className={`${getConditionColor(asset.condition)} border-0`}>
                        {asset.condition}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {}}
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {}}
                          className="p-1 hover:bg-muted rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset._id)}
                          className="p-1 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold text-foreground mt-1">{assets.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {assets.filter(a => a.status === 'assigned').length}
            </p>
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
              ₹{assets.reduce((sum, a) => sum + (a.financial?.currentValue || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
