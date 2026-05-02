import { useState, useEffect } from 'react';
import { Receipt, Plus, Upload, Filter, Calendar, DollarSign, CheckCircle, Clock, XCircle, Tag, Car, Utensils, Home, Briefcase, Plane, Heart, Book, ShoppingCart, Coffee, IndianRupee, Loader, Download } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { socketService } from '../../utils/socket';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';

interface Expense {
  _id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  receipt?: string;
  title?: string;
  employeeName?: string;
}

const expenseCategories = [
  { name: 'Travel', icon: Car, color: 'bg-blue-100 text-blue-800' },
  { name: 'Food', icon: Utensils, color: 'bg-orange-100 text-orange-800' },
  { name: 'Office', icon: Briefcase, color: 'bg-purple-100 text-purple-800' },
  { name: 'Home', icon: Home, color: 'bg-green-100 text-green-800' },
  { name: 'Entertainment', icon: Coffee, color: 'bg-pink-100 text-pink-800' },
  { name: 'Health', icon: Heart, color: 'bg-red-100 text-red-800' },
  { name: 'Education', icon: Book, color: 'bg-indigo-100 text-indigo-800' },
  { name: 'Shopping', icon: ShoppingCart, color: 'bg-yellow-100 text-yellow-800' },
  { name: 'Other', icon: Tag, color: 'bg-gray-100 text-gray-800' }
];

// Currency amount display component with INR icon
const CurrencyAmount: React.FC<{ amount: number; className?: string }> = ({ amount, className }) => {
  const { selectedCurrency } = useCurrency();
  
  // For INR, format directly without conversion
  if (selectedCurrency.code === 'INR') {
    return (
      <div className={`flex items-center gap-1 ${className || ''}`}>
        <IndianRupee className="w-4 h-4 text-primary" />
        <span>{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    );
  }
  
  // For other currencies, use formatCurrency
  const { formatCurrency } = useCurrency();
  return <span className={className}>{formatCurrency(amount)}</span>;
};

export default function Expenses() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Fetch expenses from API
  useEffect(() => {
    fetchExpenses();
  }, [user?.id]);

  const fetchExpenses = async () => {
    if (!user?.id) {
      console.warn('No user ID available');
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      console.log('Fetching expenses for user:', user.id);
      const response = await fetch(`http://localhost:5000/api/expenses/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch expenses:', response.status, response.statusText);
        throw new Error('Failed to fetch expenses');
      }

      const data = await response.json();
      console.log('Fetched expenses:', data);
      setExpenses(data.data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  // Real-time expense updates
  useEffect(() => {
    if (!socketService.isConnected()) return;

    const handleExpenseUpdated = (data: any) => {
      if (data.expense && data.expense.userId === user?.id) {
        setExpenses(prev => prev.map(exp => 
          exp._id === data.expense._id ? { ...exp, ...data.expense } : exp
        ));
        if (data.expense.status === 'approved') {
          toast.success('Expense approved!');
        } else if (data.expense.status === 'rejected') {
          toast.error('Expense rejected');
        }
      }
    };

    socketService.on('expense_updated', handleExpenseUpdated);
    socketService.on('expense_approved', handleExpenseUpdated);
    socketService.on('expense_rejected', handleExpenseUpdated);

    return () => {
      socketService.off('expense_updated', handleExpenseUpdated);
      socketService.off('expense_approved', handleExpenseUpdated);
      socketService.off('expense_rejected', handleExpenseUpdated);
    };
  }, [user?.id]);

  // Calculate expense summary from real data
  const expenseSummary = expenseCategories.map(cat => {
    const categoryExpenses = expenses.filter(e => e.category === cat.name);
    return {
      category: cat.name,
      amount: categoryExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      count: categoryExpenses.length,
      color: cat.color
    };
  }).filter(item => item.count > 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const pendingExpenses = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const approvedExpenses = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Filter expenses based on selected category and status
  const filteredExpenses = expenses.filter(expense => {
    const categoryMatch = selectedCategory === 'all' || expense.category.toLowerCase() === selectedCategory.toLowerCase();
    const statusMatch = selectedStatus === 'all' || expense.status === selectedStatus;
    return categoryMatch && statusMatch;
  });

  // Handle receipt file selection
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only PDF, PNG, and JPG files are allowed');
        return;
      }
      
      setReceiptFile(file);
      toast.success(`Receipt selected: ${file.name}`);
    }
  };

  // Handle receipt download
  const handleDownloadReceipt = (receiptPath: string, expenseTitle: string) => {
    if (!receiptPath) {
      toast.error('No receipt available');
      return;
    }

    try {
      // Create a link element
      const link = document.createElement('a');
      link.href = `http://localhost:5000${receiptPath}`;
      link.download = `${expenseTitle}-receipt${receiptPath.substring(receiptPath.lastIndexOf('.'))}`;
      link.target = '_blank';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Receipt downloaded');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt');
    }
  };

  // Handle expense submission
  const handleSubmitExpense = async () => {
    if (!user?.id || !formData.title || !formData.category || !formData.amount || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('authToken');
      console.log('Submitting expense for user:', user.id);
      
      // If there's a receipt file, upload it first
      let receiptPath = '';
      if (receiptFile) {
        const formDataWithFile = new FormData();
        formDataWithFile.append('receipt', receiptFile);
        
        const uploadResponse = await fetch('http://localhost:5000/api/expenses/upload-receipt', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formDataWithFile
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          receiptPath = uploadData.data?.filePath || '';
          console.log('Receipt uploaded:', receiptPath);
        }
      }

      // Create expense
      const expenseData = {
        title: formData.title,
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description,
        receipt: receiptPath
      };

      console.log('Submitting expense data:', expenseData);

      const response = await fetch('http://localhost:5000/api/expenses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(expenseData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to submit expense:', response.status, errorData);
        throw new Error(errorData.message || 'Failed to submit expense');
      }

      const data = await response.json();
      console.log('Expense created:', data);
      toast.success('Expense submitted successfully');
      setOpen(false);
      setFormData({ title: '', category: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
      setReceiptFile(null);
      
      // Refresh expenses
      console.log('Refreshing expenses list...');
      await fetchExpenses();
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Expenses</h1>
          <p className="text-muted-foreground">Track and submit your expense claims</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>Submit a new expense claim with receipt</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input 
                  placeholder="e.g., Client Meeting Lunch" 
                  className="rounded-xl mt-2"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select onValueChange={(value) => setFormData({...formData, category: value})} value={formData.category}>
                  <SelectTrigger className="rounded-xl mt-2">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <SelectItem key={category.name} value={category.name}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {category.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (₹) *</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="rounded-xl mt-2"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input 
                  type="date" 
                  className="rounded-xl mt-2"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  className="rounded-xl mt-2" 
                  placeholder="Enter expense details..." 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div>
                <Label>Upload Receipt</Label>
                <div className="mt-2 border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    id="receipt-upload"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleReceiptChange}
                    disabled={uploadingReceipt}
                  />
                  <label htmlFor="receipt-upload" className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {receiptFile ? receiptFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG up to 10MB</p>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" onClick={handleSubmitExpense} disabled={submitting}>
                  {submitting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit Claim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <CurrencyAmount amount={pendingExpenses} className="text-xl font-bold text-foreground" />
            </div>
          </div>
        </Card>
        <Card className="p-6 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <CurrencyAmount amount={approvedExpenses} className="text-xl font-bold text-foreground" />
            </div>
          </div>
        </Card>
        <Card className="p-6 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <CurrencyAmount amount={totalExpenses} className="text-xl font-bold text-foreground" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <div className="flex gap-3 flex-1">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {expenseCategories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <SelectItem key={category.name} value={category.name.toLowerCase()}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {category.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[180px] rounded-xl" placeholder="From Date" />
            <Input type="date" className="w-[180px] rounded-xl" placeholder="To Date" />
          </div>
          <Button variant="outline" className="rounded-xl">Apply Filters</Button>
        </div>
      </Card>

      {/* Expense List */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Expense Claims</h3>
          <p className="text-sm text-muted-foreground">Your submitted expense claims {filteredExpenses.length > 0 && `(${filteredExpenses.length})`}</p>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-6 text-center">
              <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading expenses...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-6 text-center">
              <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">{expenses.length === 0 ? 'No expenses submitted yet' : 'No expenses match your filters'}</p>
            </div>
          ) : (
            filteredExpenses.map((expense) => (
              <div key={expense._id} className="p-6 hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Receipt className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{expense.title || expense.description}</h4>
                        {expense.receipt && (
                          <Badge variant="outline" className="text-xs">
                            <Upload className="w-3 h-3 mr-1" />
                            Receipt
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {expense.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <CurrencyAmount amount={expense.amount} className="text-xl font-bold text-primary" />
                    </div>
                    <Badge
                      variant={
                        expense.status === 'approved' ? 'default' :
                        expense.status === 'pending' ? 'secondary' :
                        'destructive'
                      }
                      className="min-w-[100px] justify-center"
                    >
                      {expense.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {expense.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {expense.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                      {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                    </Badge>
                    {expense.receipt && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl"
                        onClick={() => handleDownloadReceipt(expense.receipt || '', expense.title || 'receipt')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
