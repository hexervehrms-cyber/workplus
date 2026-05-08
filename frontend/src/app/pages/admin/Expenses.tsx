import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Receipt, Search, Filter, Download, Eye, CheckCircle, AlertCircle, Tag, Car, Utensils, Home, Briefcase, Plane, Heart, Book, ShoppingCart, Coffee, IndianRupee, Edit, Trash2, XCircle, Loader, Train, Fuel, Hotel, Phone, Wifi, Laptop, Printer, FileText, Users, Lightbulb, Wrench, GraduationCap, Stethoscope, Building2, Truck, Package, FileDown, FileUp } from 'lucide-react';
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
  approvedBy?: {
    _id: string;
    name: string;
  };
}

const expenseCategories = [
  // Travel & Conveyance (Section 10(14))
  { name: 'Travel - Local Conveyance', icon: Car, color: 'bg-blue-100 text-blue-800' },
  { name: 'Travel - Intercity/Interstate', icon: Train, color: 'bg-blue-200 text-blue-900' },
  { name: 'Travel - Air Fare', icon: Plane, color: 'bg-sky-100 text-sky-800' },
  { name: 'Travel - Fuel & Mileage', icon: Fuel, color: 'bg-orange-100 text-orange-800' },
  { name: 'Travel - Hotel & Lodging', icon: Hotel, color: 'bg-purple-100 text-purple-800' },
  
  // Meals & Entertainment (Section 37)
  { name: 'Meals - Business', icon: Utensils, color: 'bg-amber-100 text-amber-800' },
  { name: 'Client Entertainment', icon: Coffee, color: 'bg-pink-100 text-pink-800' },
  
  // Office & Equipment (Section 32 - Depreciation)
  { name: 'Office Supplies & Stationery', icon: FileText, color: 'bg-indigo-100 text-indigo-800' },
  { name: 'Computer & IT Equipment', icon: Laptop, color: 'bg-violet-100 text-violet-800' },
  { name: 'Office Equipment', icon: Printer, color: 'bg-slate-100 text-slate-800' },
  { name: 'Furniture & Fixtures', icon: Building2, color: 'bg-stone-100 text-stone-800' },
  
  // Communication (Section 37)
  { name: 'Telephone & Mobile', icon: Phone, color: 'bg-green-100 text-green-800' },
  { name: 'Internet & Broadband', icon: Wifi, color: 'bg-teal-100 text-teal-800' },
  
  // Professional Development (Section 37)
  { name: 'Training & Certification', icon: GraduationCap, color: 'bg-emerald-100 text-emerald-800' },
  { name: 'Books & Subscriptions', icon: Book, color: 'bg-cyan-100 text-cyan-800' },
  { name: 'Conference & Seminars', icon: Users, color: 'bg-blue-100 text-blue-900' },
  
  // Medical & Health (Section 17(2))
  { name: 'Medical Expenses', icon: Stethoscope, color: 'bg-red-100 text-red-800' },
  { name: 'Health Insurance Premium', icon: Heart, color: 'bg-rose-100 text-rose-800' },
  
  // Utilities & Maintenance (Section 37)
  { name: 'Utilities - Electricity/Water', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-800' },
  { name: 'Repairs & Maintenance', icon: Wrench, color: 'bg-gray-100 text-gray-800' },
  
  // Miscellaneous
  { name: 'Courier & Shipping', icon: Truck, color: 'bg-orange-200 text-orange-900' },
  { name: 'Miscellaneous', icon: Tag, color: 'bg-gray-200 text-gray-700' }
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
  const [isViewReceiptDialogOpen, setIsViewReceiptDialogOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'edit' | 'approve' | 'reject' | 'delete'>('edit');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
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
  const [importingFile, setImportingFile] = useState(false);

  // Fetch expenses from API
  const fetchExpenses = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/expenses?page=${page}&limit=10`, {
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
      const apiUrl = (import.meta as any).env.VITE_API_URL === '/api' ? '' : ((import.meta as any).env.VITE_API_URL || '');
      link.href = `${apiUrl}${receiptPath}`;
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

  const handleViewReceipt = (receiptUrl: string) => {
    if (!receiptUrl) {
      toast.error('No receipt available');
      return;
    }
    
    // Construct the full backend URL for the receipt
    const apiUrl = (import.meta as any).env.VITE_API_URL || '';
    
    // Remove /api from the end if present to get the base backend URL
    let baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4); // Remove '/api'
    }
    
    // If receiptUrl is a relative path, prepend the backend URL
    let fullUrl = receiptUrl;
    if (receiptUrl.startsWith('/')) {
      fullUrl = `${baseUrl}${receiptUrl}`;
    }
    
    setViewingReceipt(fullUrl);
    setIsViewReceiptDialogOpen(true);
  };

  // Handle checkbox toggle
  const handleCheckboxChange = (expenseId: string) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(expenseId)) {
      newSelected.delete(expenseId);
    } else {
      newSelected.add(expenseId);
    }
    setSelectedExpenses(newSelected);
    setSelectAll(false);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedExpenses(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(filteredExpenses.map(e => e._id));
      setSelectedExpenses(allIds);
      setSelectAll(true);
    }
  };

  // Handle bulk approve
  const handleBulkApprove = async () => {
    if (selectedExpenses.size === 0) {
      toast.error('Please select expenses to approve');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      
      for (const expenseId of selectedExpenses) {
        await fetch(`/api/expenses/${expenseId}/approve`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      toast.success(`${selectedExpenses.size} expense(s) approved`);
      setSelectedExpenses(new Set());
      setSelectAll(false);
      await fetchExpenses();
    } catch (error) {
      console.error('Error approving expenses:', error);
      toast.error('Failed to approve expenses');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle bulk reject
  const handleBulkReject = async () => {
    if (selectedExpenses.size === 0) {
      toast.error('Please select expenses to reject');
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('authToken');
      
      for (const expenseId of selectedExpenses) {
        await fetch(`/api/expenses/${expenseId}/reject`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rejectionReason: rejectReason
          })
        });
      }

      toast.success(`${selectedExpenses.size} expense(s) rejected`);
      setSelectedExpenses(new Set());
      setSelectAll(false);
      setRejectReason('');
      setIsActionDialogOpen(false);
      await fetchExpenses();
    } catch (error) {
      console.error('Error rejecting expenses:', error);
      toast.error('Failed to reject expenses');
    } finally {
      setActionLoading(false);
    }
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
        
        const response = await fetch(`/api/expenses/${selectedExpense._id}`, {
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
        const response = await fetch(`/api/expenses/${selectedExpense._id}/approve`, {
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
        // Reject expense (single or bulk)
        if (selectedExpenses.size > 0) {
          // Bulk reject
          await handleBulkReject();
          return;
        } else if (selectedExpense) {
          // Single reject
          const response = await fetch(`/api/expenses/${selectedExpense._id}/reject`, {
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
        }
        await fetchExpenses();
      } else if (actionType === 'delete') {
        // Delete expense
        const response = await fetch(`/api/expenses/${selectedExpense._id}`, {
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
      const response = await fetch('/api/expenses', {
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

  // Export expenses to CSV or Excel
  const handleExportExpenses = async (format: 'csv' | 'excel') => {
    try {
      if (expenses.length === 0) {
        toast.error('No expenses to export');
        return;
      }

      // Prepare data for export
      const exportData = expenses.map(expense => ({
        'Employee': expense.employeeName || '',
        'Title': expense.title || '',
        'Category': expense.category || '',
        'Amount': expense.amount || 0,
        'Date': new Date(expense.date).toLocaleDateString('en-IN'),
        'Status': expense.status || '',
        'Description': expense.description || ''
      }));

      if (format === 'csv') {
        // Export as CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join(','),
          ...exportData.map(row =>
            headers.map(header => {
              const value = row[header as keyof typeof row];
              const stringValue = String(value);
              return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
            }).join(',')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `expenses-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Expenses exported as CSV');
      } else {
        // Export as Excel
        const headers = Object.keys(exportData[0]);
        let excelContent = headers.join('\t') + '\n';
        excelContent += exportData.map(row =>
          headers.map(header => row[header as keyof typeof row]).join('\t')
        ).join('\n');

        const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `expenses-${new Date().toISOString().split('T')[0]}.xls`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Expenses exported as Excel');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export expenses');
    }
  };

  // Import expenses from CSV or Excel
  const handleImportExpenses = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingFile(true);
      const text = await file.text();
      
      // Detect delimiter (comma or tab)
      const firstLine = text.split('\n')[0];
      const delimiter = firstLine.includes('\t') ? '\t' : ',';
      
      // Split by newline and filter empty lines
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Invalid file format - file must have header and at least one data row');
        return;
      }

      // Parse headers with proper CSV handling
      const parseCSVLine = (line: string, delim: string) => {
        const result = [];
        let current = '';
        let insideQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          if (char === '"') {
            if (insideQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              insideQuotes = !insideQuotes;
            }
          } else if (char === delim && !insideQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const headers = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase());
      
      // Find column indices with flexible matching
      const titleIndex = headers.findIndex(h => h.includes('title') || h.includes('expense') || h.includes('description'));
      const categoryIndex = headers.findIndex(h => h.includes('category') || h.includes('type'));
      const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('price'));
      const dateIndex = headers.findIndex(h => h.includes('date'));
      const descriptionIndex = headers.findIndex(h => h.includes('description') || h.includes('notes') || h.includes('remarks'));

      if (titleIndex === -1 || categoryIndex === -1 || amountIndex === -1) {
        toast.error('CSV must contain Title/Expense, Category/Type, and Amount/Cost columns');
        return;
      }

      // Parse data rows
      const importedExpenses = [];
      const failedRows = [];
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i], delimiter);
          
          // Skip empty rows
          if (values.every(v => !v)) continue;
          
          // Validate required fields exist
          if (!values[titleIndex] || !values[categoryIndex] || !values[amountIndex]) {
            failedRows.push({
              row: i + 1,
              reason: 'Missing required fields (Title, Category, or Amount)'
            });
            continue;
          }

          const title = values[titleIndex].trim();
          const category = values[categoryIndex].trim();
          const amountStr = values[amountIndex].trim();
          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
          
          // Validate amount
          if (amount <= 0) {
            failedRows.push({
              row: i + 1,
              reason: `Invalid amount: ${amountStr}`
            });
            continue;
          }

          // Parse date
          let dateStr = new Date().toISOString().split('T')[0];
          if (dateIndex !== -1 && values[dateIndex]) {
            try {
              const parsedDate = new Date(values[dateIndex].trim());
              if (!isNaN(parsedDate.getTime())) {
                dateStr = parsedDate.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Could not parse date: ${values[dateIndex]}`);
            }
          }

          const expense = {
            title,
            category,
            amount,
            date: dateStr,
            description: descriptionIndex !== -1 ? values[descriptionIndex]?.trim() || '' : ''
          };

          importedExpenses.push(expense);
        } catch (rowError) {
          console.error(`Error parsing row ${i + 1}:`, rowError);
          failedRows.push({
            row: i + 1,
            reason: 'Error parsing row data'
          });
        }
      }

      if (importedExpenses.length === 0) {
        const errorMsg = failedRows.length > 0 
          ? `No valid expenses found. Issues: ${failedRows.map(r => `Row ${r.row}: ${r.reason}`).join('; ')}`
          : 'No valid expenses found in file';
        toast.error(errorMsg);
        return;
      }

      // Submit imported expenses
      const token = localStorage.getItem('authToken');
      let successCount = 0;
      let failureCount = 0;
      const submitErrors = [];

      console.log(`Importing ${importedExpenses.length} expenses...`);

      for (let idx = 0; idx < importedExpenses.length; idx++) {
        const expense = importedExpenses[idx];
        try {
          const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(expense)
          });

          if (response.ok) {
            successCount++;
            console.log(`✓ Imported: ${expense.title}`);
          } else {
            const errorData = await response.json();
            failureCount++;
            submitErrors.push(`${expense.title}: ${errorData.message || 'Unknown error'}`);
            console.error(`✗ Failed to import: ${expense.title}`, errorData);
          }
        } catch (error) {
          failureCount++;
          submitErrors.push(`${expense.title}: ${error instanceof Error ? error.message : 'Network error'}`);
          console.error(`✗ Error importing: ${expense.title}`, error);
        }
      }

      // Show detailed results
      let message = `Imported ${successCount} expense${successCount !== 1 ? 's' : ''}`;
      if (failureCount > 0) {
        message += ` (${failureCount} failed)`;
      }
      if (failedRows.length > 0) {
        message += ` (${failedRows.length} rows skipped)`;
      }
      
      toast.success(message);
      
      // Show detailed error log if there were failures
      if (submitErrors.length > 0 && submitErrors.length <= 5) {
        console.log('Import errors:', submitErrors);
      }

      await fetchExpenses();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(`Failed to import expenses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImportingFile(false);
      event.target.value = '';
    }
  };

  // Download template for importing expenses
  const handleDownloadTemplate = () => {
    try {
      // Create sample data with all required columns
      const templateData = [
        {
          'Employee': 'John Doe',
          'Title': 'Client Meeting Lunch',
          'Category': 'Meals - Business',
          'Amount': 500,
          'Date': new Date().toLocaleDateString('en-IN'),
          'Description': 'Lunch meeting with client ABC'
        },
        {
          'Employee': 'Jane Smith',
          'Title': 'Travel - Local Taxi',
          'Category': 'Travel - Local Conveyance',
          'Amount': 250,
          'Date': new Date().toLocaleDateString('en-IN'),
          'Description': 'Taxi to office meeting'
        },
        {
          'Employee': 'Mike Johnson',
          'Title': 'Office Supplies',
          'Category': 'Office Supplies & Stationery',
          'Amount': 1200,
          'Date': new Date().toLocaleDateString('en-IN'),
          'Description': 'Notebooks and pens for team'
        }
      ];

      // Create Excel format (tab-separated)
      const headers = Object.keys(templateData[0]);
      let excelContent = headers.join('\t') + '\n';
      excelContent += templateData.map(row =>
        headers.map(header => row[header as keyof typeof row]).join('\t')
      ).join('\n');

      const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'expenses-template.xls');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Failed to download template');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Manage employee expense claims</p>
        </div>
        <div className="flex gap-2">
          {/* Export Button */}
          <div className="relative group">
            <Button 
              variant="outline" 
              className="rounded-xl"
              title="Export expenses"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
            <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => handleExportExpenses('csv')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm rounded-t-lg"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExportExpenses('excel')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm rounded-b-lg border-t border-gray-200"
              >
                Export as Excel
              </button>
            </div>
          </div>

          {/* Import Button */}
          <label className="cursor-pointer">
            <Button 
              variant="outline" 
              className="rounded-xl"
              asChild
              title="Import expenses from CSV or Excel"
            >
              <span>
                <FileUp className="w-4 h-4 mr-2" />
                Import
              </span>
            </Button>
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleImportExpenses}
              disabled={importingFile}
              className="hidden"
            />
          </label>

          {/* Download Template Button */}
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={handleDownloadTemplate}
            title="Download template for importing expenses"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Template
          </Button>

          {/* New Expense Button */}
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

      {/* Bulk Actions */}
      {selectedExpenses.size > 0 && (
        <Card className="p-4 rounded-xl bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{selectedExpenses.size} expense(s) selected</p>
            <div className="flex gap-2">
              <Button 
                className="rounded-xl bg-green-600 hover:bg-green-700"
                onClick={handleBulkApprove}
                disabled={actionLoading}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve Selected
              </Button>
              <Button 
                className="rounded-xl bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setActionType('reject');
                  setRejectReason('');
                  setIsActionDialogOpen(true);
                }}
                disabled={actionLoading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject Selected
              </Button>
            </div>
          </div>
        </Card>
      )}

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
                  <th className="text-left p-4 w-12">
                    <input 
                      type="checkbox" 
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-4">Employee</th>
                  <th className="text-left p-4">Description</th>
                  <th className="text-left p-4">Category</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Approved By</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => {
                  const CategoryIcon = getCategoryIcon(expense.category);
                  return (
                    <tr key={expense._id} className="border-b hover:bg-accent/50">
                      <td className="p-4 w-12">
                        <input 
                          type="checkbox" 
                          checked={selectedExpenses.has(expense._id)}
                          onChange={() => handleCheckboxChange(expense._id)}
                          className="rounded"
                        />
                      </td>
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
                        {expense.approvedBy ? (
                          <div>
                            <p className="font-medium">{expense.approvedBy.name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">Approved</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
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
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleViewReceipt(expense.receipt || '')}
                                disabled={actionLoading}
                                title="View receipt"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDownloadReceipt(expense.receipt || '', expense.title || 'receipt')}
                                disabled={actionLoading}
                                title="Download receipt"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </>
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

      {/* View Receipt Dialog */}
      <Dialog open={isViewReceiptDialogOpen} onOpenChange={setIsViewReceiptDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>View Receipt</DialogTitle>
            <DialogDescription>
              Receipt preview
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {viewingReceipt && viewingReceipt.trim() ? (
              <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4">
                {viewingReceipt.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <div className="w-full">
                    <img 
                      src={viewingReceipt} 
                      alt="Receipt" 
                      className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                      onLoad={() => console.log('Image loaded successfully:', viewingReceipt)}
                      onError={(e) => {
                        console.error('Image load error:', viewingReceipt);
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'text-center py-8';
                        errorDiv.innerHTML = `
                          <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                          <p class="text-gray-600 mb-2 font-medium">Receipt file not found</p>
                          <p class="text-sm text-gray-500 mb-4">The receipt file may have been moved or deleted</p>
                          <p class="text-xs text-gray-400 font-mono break-all px-4">${viewingReceipt}</p>
                        `;
                        e.currentTarget.replaceWith(errorDiv);
                      }}
                    />
                  </div>
                ) : viewingReceipt.match(/\.pdf$/i) ? (
                  <div className="w-full">
                    <iframe 
                      src={viewingReceipt} 
                      className="w-full h-[600px] rounded-lg shadow-lg"
                      title="Receipt PDF"
                      onError={(e) => {
                        console.error('PDF load error:', viewingReceipt);
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'text-center py-8';
                          errorDiv.innerHTML = `
                            <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p class="text-gray-600 mb-2 font-medium">PDF file not found</p>
                            <p class="text-sm text-gray-500 mb-4">The receipt file may have been moved or deleted</p>
                            <p class="text-xs text-gray-400 font-mono break-all px-4">${viewingReceipt}</p>
                            <button onclick="window.open('${viewingReceipt}', '_blank')" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                              Try Opening in New Tab
                            </button>
                          `;
                          parent.appendChild(errorDiv);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                    <p className="text-xs text-gray-500 mb-4 break-all">{viewingReceipt}</p>
                    <Button 
                      onClick={() => window.open(viewingReceipt, '_blank')}
                      className="rounded-xl"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Open in New Tab
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No receipt available</p>
                <p className="text-sm text-gray-500">This expense does not have a receipt attached. Please upload a receipt to view it here.</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl" 
              onClick={() => setIsViewReceiptDialogOpen(false)}
            >
              Close
            </Button>
            {viewingReceipt && viewingReceipt.trim() && (
              <Button 
                className="flex-1 rounded-xl" 
                onClick={() => handleDownloadReceipt(viewingReceipt, 'receipt')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

