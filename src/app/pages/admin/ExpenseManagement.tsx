import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Receipt, 
  Calendar, 
  FileText, 
  Briefcase,
  Coffee,
  Car,
  Home,
  Plane,
  Filter,
  Search,
  Bell
} from 'lucide-react';
import { ExpenseService } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

interface Expense {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: 'employee' | 'accountant';
  category: 'travel' | 'meals' | 'accommodation' | 'supplies' | 'other';
  amount: number;
  currency: string;
  description: string;
  date: string;
  receiptUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  department: string;
  project?: string;
}

const ExpenseManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch expenses on component mount
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true);
        const expensesData = await ExpenseService.getAllExpenses();
        setExpenses(expensesData || []);
      } catch (error) {
        console.error('Failed to fetch expenses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const handleBulkApprove = async () => {
    try {
      setLoading(true);
      const approvedExpenses = await ExpenseService.bulkApproveExpenses(Array.from(selectedExpenses));
      if (approvedExpenses) {
        setExpenses(prev => 
          prev.map(expense => 
            approvedExpenses.find(approved => approved.id === expense.id) 
              ? approvedExpenses.find(approved => approved.id === expense.id)!
              : expense
          )
        );
        setSelectedExpenses(new Set());
        setBulkAction(null);
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Failed to bulk approve expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = async () => {
    try {
      setLoading(true);
      const rejectedExpenses = await ExpenseService.bulkRejectExpenses(Array.from(selectedExpenses), 'Bulk rejected by admin');
      if (rejectedExpenses) {
        setExpenses(prev => 
          prev.map(expense => 
            rejectedExpenses.find(rejected => rejected.id === expense.id) 
              ? rejectedExpenses.find(rejected => rejected.id === expense.id)!
              : expense
          )
        );
        setSelectedExpenses(new Set());
        setBulkAction(null);
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Failed to bulk reject expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (expenseId: string) => {
    try {
      setLoading(true);
      const approvedExpense = await ExpenseService.approveExpense(expenseId);
      if (approvedExpense) {
        setExpenses(prev => 
          prev.map(expense => 
            expense.id === expenseId 
              ? approvedExpense
              : expense
          )
        );
      }
    } catch (error) {
      console.error('Failed to approve expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (expenseId: string) => {
    try {
      setLoading(true);
      const rejectedExpense = await ExpenseService.rejectExpense(expenseId, 'Rejected by admin');
      if (rejectedExpense) {
        setExpenses(prev => 
          prev.map(expense => 
            expense.id === expenseId 
              ? rejectedExpense
              : expense
          )
        );
      }
    } catch (error) {
      console.error('Failed to reject expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryInfo = (category: string) => {
    const categories = {
      travel: { icon: Car, color: 'bg-blue-100 text-blue-800', label: 'Travel' },
      meals: { icon: Coffee, color: 'bg-orange-100 text-orange-800', label: 'Meals' },
      accommodation: { icon: Home, color: 'bg-purple-100 text-purple-800', label: 'Accommodation' },
      supplies: { icon: Briefcase, color: 'bg-green-100 text-green-800', label: 'Supplies' },
      other: { icon: FileText, color: 'bg-gray-100 text-gray-800', label: 'Other' }
    };
    return categories[category as keyof typeof categories] || categories.other;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'accountant': return 'bg-indigo-100 text-indigo-800';
      case 'employee': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesFilter = filter === 'all' || expense.status === filter;
    const matchesSearch = expense.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesFilter && matchesSearch && matchesCategory;
  });

  const pendingCount = expenses.filter(exp => exp.status === 'pending').length;
  const totalPendingAmount = expenses
    .filter(exp => exp.status === 'pending')
    .reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-8 space-y-6">
      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <Bell className="w-5 h-5" />
          <div>
            <p className="font-medium">New Expense Submitted!</p>
            <p className="text-sm">Employee has submitted a new expense for review</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowNotification(false)}
            className="text-white hover:bg-blue-600"
          >
            ×
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Expense Management</h1>
          <p className="text-muted-foreground">Review and manage employee expense submissions</p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {pendingCount} Pending (${totalPendingAmount.toFixed(2)})
            </Badge>
          )}
          <Button>
            <Bell className="w-4 h-4 mr-2" />
            Notify All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expenses.filter(exp => exp.status === 'approved').length}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expenses.filter(exp => exp.status === 'rejected').length}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalPendingAmount.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pending Amount</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status === 'pending' && pendingCount > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1 border rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              <option value="travel">Travel</option>
              <option value="meals">Meals</option>
              <option value="accommodation">Accommodation</option>
              <option value="supplies">Supplies</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            {selectedExpenses.size > 0 && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setBulkAction('approve')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve Selected ({selectedExpenses.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkAction('reject')}
                >
                  Reject Selected ({selectedExpenses.size})
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border bg-background py-2 pl-10 pr-4"
            />
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium">
                  <input
                    type="checkbox"
                    checked={selectedExpenses.size === filteredExpenses.length && filteredExpenses.every(exp => selectedExpenses.has(exp.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedExpenses(new Set(filteredExpenses.map(exp => exp.id)));
                      } else {
                        setSelectedExpenses(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-4 font-medium">Employee</th>
                <th className="text-left p-4 font-medium">Category</th>
                <th className="text-left p-4 font-medium">Amount</th>
                <th className="text-left p-4 font-medium">Description</th>
                <th className="text-left p-4 font-medium">Date</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => {
                const CategoryInfo = getCategoryInfo(expense.category);
                
                return (
                  <tr key={expense.id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.has(expense.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpenses(prev => new Set(prev).add(expense.id));
                          } else {
                            setSelectedExpenses(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(expense.id);
                              return newSet;
                            });
                          }
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{expense.employeeName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">{expense.employeeId}</span>
                          <Badge className={getRoleColor(expense.employeeRole)}>
                            {expense.employeeRole}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{expense.department}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <CategoryInfo.icon className="w-4 h-4" />
                        <Badge className={CategoryInfo.color}>
                          {CategoryInfo.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </div>
                      {expense.project && (
                        <p className="text-sm text-muted-foreground">{expense.project}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-sm max-w-xs truncate" title={expense.description}>
                        {expense.description}
                      </p>
                      {expense.receiptUrl && (
                        <Button variant="outline" size="sm" className="mt-1">
                          <Receipt className="w-3 h-3 mr-1" />
                          Receipt
                        </Button>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <p>{new Date(expense.date).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {new Date(expense.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={getStatusColor(expense.status)}>
                        {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {expense.status === 'pending' && (
                          <>
                            {selectedExpenses.size > 0 && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (selectedExpenses.has(expense.id)) {
                                    handleApprove(expense.id);
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setSelectedExpense(expense)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {expense.status === 'approved' && (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Approved by {expense.reviewedBy}</span>
                          </div>
                        )}
                        {expense.status === 'rejected' && (
                          <div className="flex items-center gap-2 text-sm text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span>Rejected by {expense.reviewedBy}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Rejection Dialog */}
      {selectedExpense && (
        <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedExpense.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  Amount: {selectedExpense.currency} {selectedExpense.amount.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Description: {selectedExpense.description}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Rejection Reason</label>
                <textarea
                  className="w-full p-2 border rounded-lg min-h-[100px]"
                  placeholder="Enter reason for rejection..."
                  onChange={(e) => setSelectedExpense({...selectedExpense, rejectionReason: e.target.value})}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(selectedExpense.id, selectedExpense.rejectionReason || '');
                    setSelectedExpense(null);
                  }}
                  disabled={!selectedExpense.rejectionReason?.trim()}
                >
                  Reject Expense
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedExpense(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ExpenseManagement;
