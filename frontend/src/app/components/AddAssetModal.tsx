import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from '../utils/portalToast';
import { apiPost } from '../utils/apiHelper';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAssetModal({ isOpen, onClose, onSuccess }: AddAssetModalProps) {
  const [formData, setFormData] = useState({
    assetName: '',
    category: '',
    serialNumber: '',
    condition: 'excellent',
    purchasePrice: '',
    currentValue: '',
    location: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.assetName.trim()) {
      toast.error('Asset Name is required');
      return;
    }

    if (!formData.category) {
      toast.error('Category is required');
      return;
    }

    // Validate numeric fields if provided
    if (formData.purchasePrice && isNaN(parseFloat(formData.purchasePrice))) {
      toast.error('Purchase Price must be a valid number');
      return;
    }

    if (formData.currentValue && isNaN(parseFloat(formData.currentValue))) {
      toast.error('Current Value must be a valid number');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        assetName: formData.assetName.trim(),
        category: formData.category,
        serialNumber: formData.serialNumber.trim() || undefined,
        condition: formData.condition,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : undefined,
        currentValue: formData.currentValue ? parseFloat(formData.currentValue) : undefined,
        location: formData.location.trim() || undefined,
        description: formData.description.trim() || undefined,
      };

      const response = await apiPost('assets/my', payload);

      if (response?.success) {
        toast.success('Asset added successfully! Pending admin review.');
        
        // Reset form
        setFormData({
          assetName: '',
          category: '',
          serialNumber: '',
          condition: 'excellent',
          purchasePrice: '',
          currentValue: '',
          location: '',
          description: '',
        });

        // Close modal and refresh list
        onClose();
        onSuccess();
      } else {
        toast.error(response?.message || 'Failed to add asset');
      }
    } catch (error) {
      console.error('Error adding asset:', error);
      toast.error(
        error?.response?.data?.message || error instanceof Error ? error.message : 'Failed to add asset. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
          <DialogDescription>
            Add a new asset to your portfolio. Your asset will be reviewed by admin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Name */}
          <div className="space-y-2">
            <Label htmlFor="assetName">Asset Name *</Label>
            <Input
              id="assetName"
              name="assetName"
              placeholder="e.g., Lenovo Laptop"
              value={formData.assetName}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => handleSelectChange('category', value)}>
              <SelectTrigger id="category" disabled={loading}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IT_Equipment">IT Equipment</SelectItem>
                <SelectItem value="Office_Furniture">Office Furniture</SelectItem>
                <SelectItem value="Vehicle">Vehicle</SelectItem>
                <SelectItem value="Software">Software</SelectItem>
                <SelectItem value="Security">Security</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Serial Number */}
          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              name="serialNumber"
              placeholder="e.g., ABC123DEF456"
              value={formData.serialNumber}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select value={formData.condition} onValueChange={(value) => handleSelectChange('condition', value)}>
              <SelectTrigger id="condition" disabled={loading}>
                <SelectValue placeholder="Select condition" />
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

          {/* Purchase Price */}
          <div className="space-y-2">
            <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
            <Input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              placeholder="e.g., 50000"
              value={formData.purchasePrice}
              onChange={handleChange}
              disabled={loading}
              min="0"
              step="0.01"
            />
          </div>

          {/* Current Value */}
          <div className="space-y-2">
            <Label htmlFor="currentValue">Current Value (₹)</Label>
            <Input
              id="currentValue"
              name="currentValue"
              type="number"
              placeholder="e.g., 40000"
              value={formData.currentValue}
              onChange={handleChange}
              disabled={loading}
              min="0"
              step="0.01"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location / Desk</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g., Noida Office, Desk 5"
              value={formData.location}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description / Notes</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Additional details about the asset"
              value={formData.description}
              onChange={handleChange}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Adding...' : 'Add Asset'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
