import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Receipt, Search, Filter, Download, Eye, CheckCircle, AlertCircle, Tag, Car, Utensils, Home, Briefcase, Plane, Heart, Book, ShoppingCart, Coffee, IndianRupee, Edit, Trash2, XCircle, Loader } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

interface Expense {
  _id: string;
  employeeName: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  title: string;
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
  
  // For INR, just format without conversion since amounts are already in INR
  if (selectedCurrency.code === 'INR') {
    return (
      <div className={`flex items-center gap-1 ${className || ''}`}>
        <IndianRupee className="w-4 h-4 text-primary" />
        <span>{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    );
  }
  
  // For other currencies, use the currency context
  const { formatCurrency } = useCurrency();
  return <span className={className}>{formatCurrency(amount)}</span>;
};

export default function ExpensesAdmin() {
  const { formatCurrency } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isNewExpenseDialogOpen, setIsNewExpenseDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'edit' | 'approve' | 'reject' | 'delete'>('edit');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    category: '',
    description: '',
    amount: '',
    date: ''
  });
  const [newExpenseData, setNewExpenseData] = useState({
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    title: ''
  });
  const [rejectReason, setRejectReason] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [page, setPage] = useState(1);

  // Fetch expenses from API
  const fetchExpenses = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:5000/api/expenses?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }

      const data = await response.json();
      console.log('Fetched expenses data:', data);
      console.log('Expenses array:', data.data);
      setExpenses(data.data || []);
      setTotalExpenses(data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to fetch expenses');
    }
  }, [page]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Log whenever expenses change to verify calculations
  useEffect(() => {
    const pendingTotal = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0);
    const approvedTotal = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0);
    console.log('Expenses updated:', {
      total: expenses.length,
      pending: expenses.filter(e => e.status === 'pending').length,
      pendingAmount: pendingTotal,
      approved: expenses.filter(e => e.status === 'approved').length,
      approvedAmount: approvedTotal,
      allExpenses: expenses.map(e => ({ 
        id: e._id, 
        amount: e.amount, 
        amountType: typeof e.amount,
        status: e.status,
        title: e.title 
      }))
    });
  }, [expenses]);

  const filteredExpenses = selectedCategory === 'all' 
    ? expenses 
    : expenses.filter(expense => expense.category === selectedCategory);

  const getCategoryIcon = (categoryName: string) => {
    const category = expenseCategories.find(cat => cat.name === categoryName);
    return category ? category.icon : Tag;
  };

  const getCategoryColor = (categoryName: string) => {
    const category = expenseCategories.find(cat => cat.name === categoryName);
    return category ? category.color : 'bg-gray-100 text-gray-800';
  };

  // Handle document download
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

  // Handle edit action
  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditFormData({
      title: expense.title,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      date: new Date(expense.date).toISOString().split('T')[0]
    });
    setActionType('edit');
    setIsEditDialogOpen(true);
  };

  // Handle approve action
  const handleApprove = (expense: Expense) => {
    setSelectedExpense(expense);
    setActionType('approve');
    setIsActionDialogOpen(true);
  };

  // Handle reject action
  const handleReject = (expense: Expense) => {
    setSelectedExpense(expense);
    setActionType('reject');
    setRejectReason('');
    setIsActionDialogOpen(true);
  };

  // Handle delete action
  const handleDelete = (expense: Expense) => {
    setSelectedExpense(expense);
    setActionType('delete');
    setIsActionDialogOpen(true);
  };

  // Process action
  const processAction = async () => {
    if (!selectedExpense) return;

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');

      if (actionType === 'edit') {
        // Update expense
        const updateData = {
          title: editFormData.title,
          category: editFormData.category,
          description: editFormData.description,
          amount: parseFloat(editFormData.amount),
          date: editFormData.date
        };
        console.log('Sending update data:', updateData);
        
        const response = await fetch(`http://localhost:5000/api/expenses/${selectedExpense._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });

        if (!response.ok) {
          throw new Error('Failed to update expense');
        }

        toast.success('Expense updated successfully');
        setIsEditDialogOpen(false);
        await fetchExpenses();
      } else if (actionType === 'approve') {
        // Approve expense
        const response = await fetch(`http://localhost:5000/api/expenses/${selectedExpense._id}/approve`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to approve expense');
        }

        console.log('Expense approved, fetching updated list...');
        toast.success('Expense approved successfully');
        setIsActionDialogOpen(false);
        await fetchExpenses();
        console.log('Expenses list updated after approval');
      } else if (actionType === 'reject') {
        // Reject expense
        const response = await fetch(`http://localhost:5000/api/expenses/${selectedExpense._id}/reject`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rejectionReason: rejectReason
          })
        });

        if (!response.ok) {
          throw new Error('Failed to reject expense');
        }

        toast.success('Expense rejected');
        setIsActionDialogOpen(false);
        await fetchExpenses();
      } else if (actionType === 'delete') {
        // Delete expense
        const response = await fetch(`http://localhost:5000/api/expenses/${selectedExpense._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to delete expense');
        }

        toast.success('Expense deleted');
        setIsActionDialogOpen(false);
        await fetchExpenses();
      }
    } catch (error) {
      console.error('Error processing action:', error);
      toast.error('Failed to process action');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle create new expense
  const handleCreateExpense = async () => {
    if (!newExpenseData.title || !newExpenseData.category || !newExpenseData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/expenses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newExpenseData.title,
          category: newExpenseData.category,
          description: newExpenseData.description,
          amount: parseFloat(newExpenseData.amount),
          date: newExpenseData.date
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create expense');
      }

      toast.success('Expense created successfully');
      setIsNewExpenseDialogOpen(false);
      setNewExpenseData({
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        title: ''
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error('Failed to create expense');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Manage employee expense claims</p>
        </div>
        <Button className="rounded-xl" onClick={() => {
          setNewExpenseData({
            category: '',
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            title: ''
          });
          setIsNewExpenseDialogOpen(true);
        }}>
          <Receipt className="w-4 h-4 mr-2" />
          New Expense
        </Button>
      </div>

      {/* Category Filter */}
      <Card className="p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4" />
          <h3 className="font-semibold">Filter by Category</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            className="rounded-lg"
            onClick={() => setSelectedCategory('all')}
          >
            All Categories
          </Button>
          {expenseCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.name}
                variant={selectedCategory === category.name ? 'default' : 'outline'}
                size="sm"
                className="rounded-lg"
                onClick={() => setSelectedCategory(category.name)}
              >
                <Icon className="w-4 h-4 mr-1" />
                {category.name}
              </Button>
            );
          })}
        </div>
      </Card>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search expenses..."
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-background"
          />
        </div>
        <Button variant="outline" className="rounded-xl">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{expenses.filter(e => e.status === 'pending').length}</p>
              </div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <div className="text-sm font-semibold mt-1 flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />
                <span>{(expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{expenses.filter(e => e.status === 'approved').length}</p>
              </div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <div className="text-sm font-semibold mt-1 flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />
                <span>{(expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xl font-bold flex items-center gap-1">
                <IndianRupee className="w-5 h-5" />
                <span>{(expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Claimed</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-xl">
        <div className="overflow-x-auto">
          {filteredExpenses.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">No expenses found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Employee</th>
                  <th className="text-left p-4">Description</th>
                  <th className="text-left p-4">Category</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => {
                  const CategoryIcon = getCategoryIcon(expense.category);
                  return (
                    <tr key={expense._id} className="border-b hover:bg-accent/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{expense.employeeName.split(' ').map(n => n[0]).join('')}</span>
                          </div>
                          <div>
                            <p className="font-medium">{expense.employeeName}</p>
                            <p className="text-sm text-muted-foreground">{expense.employeeName.toLowerCase().replace(' ', '')}@company.com</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-medium">{expense.description || expense.title}</p>
                      </td>
                      <td className="p-4">
                        <Badge className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(expense.category)}`}>
                          <CategoryIcon className="w-3 h-3 mr-1" />
                          {expense.category}
                        </Badge>
                      </td>
                      <td className="p-4 font-medium"><CurrencyAmount amount={expense.amount} /></td>
                      <td className="p-4">
                        <p className="font-medium">{new Date(expense.date).toISOString().split('T')[0]}</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.floor((new Date().getTime() - new Date(expense.date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {expense.receipt && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownloadReceipt(expense.receipt || '', expense.title || 'receipt')}
                              disabled={actionLoading}
                              title="Download receipt"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(expense)} disabled={actionLoading}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleApprove(expense)} disabled={actionLoading || expense.status !== 'pending'}>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleReject(expense)} disabled={actionLoading || expense.status !== 'pending'}>
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(expense)} disabled={actionLoading}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input 
                value={editFormData.title}
                onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                className="rounded-xl mt-2"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select onValueChange={(value) => setEditFormData({...editFormData, category: value})} value={editFormData.category}>
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
              <Label>Description</Label>
              <Textarea 
                value={editFormData.description}
                onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                className="rounded-xl mt-2" 
                rows={3}
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input 
                type="number" 
                value={editFormData.amount}
                onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                className="rounded-xl mt-2"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input 
                type="date" 
                value={editFormData.date}
                onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                className="rounded-xl mt-2"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsEditDialogOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={processAction} disabled={actionLoading}>
                {actionLoading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Approve/Reject/Delete) */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? 'Approve Expense' : actionType === 'reject' ? 'Reject Expense' : 'Delete Expense'}</DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && 'Are you sure you want to approve this expense?'}
              {actionType === 'reject' && 'Please provide a reason for rejection:'}
              {actionType === 'delete' && 'Are you sure you want to delete this expense? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          {actionType === 'reject' && (
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="rounded-xl mt-2" 
                placeholder="Enter rejection reason..."
                rows={3}
              />
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsActionDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button 
              className={`flex-1 rounded-xl ${actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={processAction}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'delete' && 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Expense Dialog */}
      <Dialog open={isNewExpenseDialogOpen} onOpenChange={setIsNewExpenseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Expense</DialogTitle>
            <DialogDescription>Add a new expense claim</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input 
                value={newExpenseData.title}
                onChange={(e) => setNewExpenseData({...newExpenseData, title: e.target.value})}
                className="rounded-xl mt-2"
                placeholder="Enter expense title"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select onValueChange={(value) => setNewExpenseData({...newExpenseData, category: value})}>
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
              <Label>Description</Label>
              <Textarea 
                value={newExpenseData.description}
                onChange={(e) => setNewExpenseData({...newExpenseData, description: e.target.value})}
                className="rounded-xl mt-2" 
                placeholder="Enter expense description"
                rows={3}
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input 
                type="number" 
                value={newExpenseData.amount}
                onChange={(e) => setNewExpenseData({...newExpenseData, amount: e.target.value})}
                className="rounded-xl mt-2"
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input 
                type="date" 
                value={newExpenseData.date}
                onChange={(e) => setNewExpenseData({...newExpenseData, date: e.target.value})}
                className="rounded-xl mt-2"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsNewExpenseDialogOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleCreateExpense} disabled={actionLoading}>
                {actionLoading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Expense
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
