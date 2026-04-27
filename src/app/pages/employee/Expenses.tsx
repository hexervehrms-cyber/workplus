import { useState, useEffect } from 'react';
import { Receipt, Plus, Upload, Filter, Calendar, DollarSign, CheckCircle, Clock, XCircle, Tag, Car, Utensils, Home, Briefcase, Plane, Heart, Book, ShoppingCart, Coffee, IndianRupee } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
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
import { ExpenseService } from '../../utils/api';
import { toast } from 'sonner';

interface Expense {
  _id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  receipt: string;
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
  const { formatCurrency, selectedCurrency } = useCurrency();
  
  if (selectedCurrency.code === 'INR') {
    return (
      <div className={`flex items-center gap-1 ${className || ''}`}>
        <IndianRupee className="w-4 h-4 text-primary" />
        <span>{formatCurrency(amount).replace('₹', '')}</span>
      </div>
    );
  }
  
  return <span className={className}>{formatCurrency(amount)}</span>;
};

export default function Expenses() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    date: '',
    description: ''
  });

  // Fetch expenses from API
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const response = await ExpenseService.getExpensesByUserId(user.id);
        if (response.success && response.data) {
          setExpenses(response.data);
        }
      } catch (error) {
        console.error('Error fetching expenses:', error);
        toast.error('Failed to load expenses');
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [user]);

  // Calculate expense summary from real data
  const expenseSummary = expenseCategories.map(cat => {
    const categoryExpenses = expenses.filter(e => e.category === cat.name);
    return {
      category: cat.name,
      amount: categoryExpenses.reduce((sum, e) => sum + e.amount, 0),
      count: categoryExpenses.length,
      color: cat.color
    };
  }).filter(item => item.count > 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Handle expense submission
  const handleSubmitExpense = async () => {
    if (!user?.id || !formData.category || !formData.amount || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const expenseData = {
        userId: user.id,
        employeeName: user.name,
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description,
        orgId: 'system'
      };

      const response = await ExpenseService.createExpense(expenseData);
      
      if (response.success) {
        toast.success('Expense submitted successfully');
        setOpen(false);
        setFormData({ category: '', amount: '', date: '', description: '' });
        
        // Refresh expenses
        const updatedExpenses = await ExpenseService.getExpensesByUserId(user.id);
        if (updatedExpenses.success && updatedExpenses.data) {
          setExpenses(updatedExpenses.data);
        }
      }
    } catch (error) {
      console.error('Error submitting expense:', error);
      toast.error('Failed to submit expense');
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
              <DialogDescription>Submit a new expense claim</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select onValueChange={(value) => setFormData({...formData, category: value})}>
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
                <Label>Amount</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="rounded-xl mt-2"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>
              <div>
                <Label>Date</Label>
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
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG up to 10MB</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" onClick={handleSubmitExpense}>
                  Submit Claim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense Summary */}
      <Card className="p-8 rounded-2xl bg-gradient-to-br from-accent/10 to-secondary/10 border-accent/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg text-muted-foreground mb-2">Total Expenses (This Month)</h3>
            <div className="flex items-baseline gap-2">
              <CurrencyAmount amount={totalExpenses} className="text-4xl font-bold text-foreground" />
            </div>
          </div>
          <div className="w-20 h-20 rounded-xl bg-accent/20 flex items-center justify-center">
            <Receipt className="w-10 h-10 text-accent" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {expenseSummary.map((item, index) => {
            const category = expenseCategories.find(cat => cat.name === item.category);
            const Icon = category ? category.icon : Tag;
            return (
              <div key={index} className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" />
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                </div>
                <CurrencyAmount amount={item.amount} className="text-xl font-bold text-foreground" />
                <p className="text-xs text-muted-foreground mt-1">{item.count} claims</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <div className="flex gap-3 flex-1">
            <Select defaultValue="all">
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
            <Select defaultValue="all">
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
          <p className="text-sm text-muted-foreground">Your submitted expense claims</p>
        </div>
        <div className="divide-y divide-border">
          {expenses.map((expense) => (
            <div key={expense.id} className="p-6 hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    expense.category === 'Travel' ? 'bg-primary/10' :
                    expense.category === 'Food' ? 'bg-secondary/10' :
                    expense.category === 'Office Supplies' ? 'bg-accent/10' :
                    'bg-muted/50'
                  }`}>
                    <Receipt className={`w-6 h-6 ${
                      expense.category === 'Travel' ? 'text-primary' :
                      expense.category === 'Food' ? 'text-secondary' :
                      expense.category === 'Office Supplies' ? 'text-accent' :
                      'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{expense.description}</h4>
                      {expense.receipt && (
                        <Badge variant="outline" className="text-xs">
                          <Upload className="w-3 h-3 mr-1" />
                          Receipt
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Receipt className="w-3 h-3" />
                        {expense.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {expense.date}
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
                      expense.status === 'Approved' ? 'default' :
                      expense.status === 'Pending' ? 'secondary' :
                      'destructive'
                    }
                    className="min-w-[100px] justify-center"
                  >
                    {expense.status === 'Approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {expense.status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                    {expense.status === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                    {expense.status}
                  </Badge>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
