import { useState, useEffect } from 'react';
import { Receipt, Plus, Upload, Filter, Calendar, DollarSign, CheckCircle, Clock, XCircle, Tag, Car, Utensils, Home, Briefcase, Plane, Heart, Book, ShoppingCart, Coffee, IndianRupee, Loader, Download, Edit, Trash2, Train, Fuel, Hotel, Phone, Wifi, Laptop, Printer, FileText, Users, Lightbulb, Wrench, GraduationCap, Stethoscope, Building2, Truck, Package, Eye, FileDown, FileUp } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import { socketService } from '../../utils/socket';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload, buildFileUrl, getBearerToken } from '../../utils/apiHelper';
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
import { toast } from '../../utils/portalToast';
import { ExpenseLimitSettingsDialog } from '../../components/ExpenseLimitSettingsDialog';

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
  userId?: string;
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
  const { selectedCurrency, formatCurrency } = useCurrency();

  if (selectedCurrency.code === 'INR') {
    return (
      <div className={`flex items-center gap-1 ${className || ''}`}>
        <IndianRupee className="w-4 h-4 text-primary" />
        <span>{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    );
  }

  return <span className={className}>{formatCurrency(amount)}</span>;
};

export default function Expenses() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewReceiptOpen, setViewReceiptOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
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
  }, [user?.userId, user?.id]);

  const fetchExpenses = async () => {
    const stableUserId = user?.userId || user?.id;
    if (!stableUserId) {
      console.warn('No user ID available');
      setError('User information not available');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet(`/expenses/user/${stableUserId}`);
      
      if (data.data && Array.isArray(data.data)) {
        setExpenses(data.data);
      } else if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load expenses';
      setError(errorMessage);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  // Real-time expense updates (registers even before socket connects; replays on reconnect)
  useEffect(() => {
    const stableUserId = user?.userId || user?.id;
    if (!stableUserId) return;

    const matchesCurrentUser = (payload: { expense?: Expense; userId?: string }) => {
      const uid = payload?.expense?.userId ?? payload?.userId;
      return uid != null && String(uid) === String(stableUserId);
    };

    const handleExpenseUpdated = (data: { expense?: Expense; userId?: string }) => {
      const expense = data?.expense;
      if (!expense || !matchesCurrentUser(data)) return;

      setExpenses((prev) =>
        prev.map((exp) => (exp._id === expense._id ? { ...exp, ...expense } : exp))
      );
      if (expense.status === 'approved') {
        toast.success('Expense approved!');
      } else if (expense.status === 'rejected') {
        toast.error('Expense rejected');
      }
    };

    socketService.on('expense_updated', handleExpenseUpdated);
    socketService.on('expense_approved', handleExpenseUpdated);
    socketService.on('expense_rejected', handleExpenseUpdated);
    socketService.on('expense:updated', handleExpenseUpdated);

    return () => {
      socketService.off('expense_updated', handleExpenseUpdated);
      socketService.off('expense_approved', handleExpenseUpdated);
      socketService.off('expense_rejected', handleExpenseUpdated);
      socketService.off('expense:updated', handleExpenseUpdated);
    };
  }, [user?.userId, user?.id]);

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

  // Filter expenses based on selected category, status, and dates
  const filteredExpenses = expenses.filter(expense => {
    const categoryMatch = selectedCategory === 'all' || expense.category.toLowerCase() === selectedCategory.toLowerCase();
    const statusMatch = selectedStatus === 'all' || expense.status === selectedStatus;
    
    // Date filtering
    let dateMatch = true;
    if (fromDate || toDate) {
      const expenseDate = new Date(expense.date);
      if (fromDate) {
        const from = new Date(fromDate);
        dateMatch = dateMatch && expenseDate >= from;
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999); // Include entire day
        dateMatch = dateMatch && expenseDate <= to;
      }
    }
    
    return categoryMatch && statusMatch && dateMatch;
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
      console.log('Download receipt - receiptPath:', receiptPath);
      
      const fullUrl = buildFileUrl(receiptPath);
      
      console.log('Download URL:', fullUrl);
      
      // Create a link element
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = `${expenseTitle}-receipt${receiptPath.substring(receiptPath.lastIndexOf('.'))}`;
      link.target = '_blank';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Receipt download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download receipt');
    }
  };

  // Handle view receipt
  const handleViewReceipt = (receiptPath: string) => {
    if (!receiptPath) {
      toast.error('No receipt available');
      return;
    }
    
    console.log('=== VIEW RECEIPT DEBUG ===');
    console.log('Receipt path from expense:', receiptPath);
    console.log('Receipt path type:', typeof receiptPath);
    console.log('Receipt path length:', receiptPath.length);
    
    const fullUrl = buildFileUrl(receiptPath);
    
    console.log('Full URL:', fullUrl);
    console.log('=== END DEBUG ===');
    
    setViewingReceipt(fullUrl);
    setViewReceiptOpen(true);
  };

  // Handle expense submission
  const handleSubmitExpense = async () => {
    if (!user?.id || !formData.title || !formData.category || !formData.amount || !formData.date) {
      toast.error('Please fill in all required fields (Title, Category, Amount, Date)');
      return;
    }

    try {
      setSubmitting(true);
      const token = getBearerToken();
      console.log(editingId ? 'Updating expense:' : 'Submitting expense for user:', user.id);
      console.log('Form data:', formData);
      
      // If there's a receipt file, upload it first
      let receiptPath = '';
      if (receiptFile) {
        const formDataWithFile = new FormData();
        formDataWithFile.append('receipt', receiptFile);
        
        try {
          const uploadData = await apiUpload('/expenses/upload-receipt', formDataWithFile);
          receiptPath = uploadData.data?.filePath || '';
          console.log('Receipt uploaded:', receiptPath);
        } catch (uploadError) {
          console.error('Receipt upload failed:', uploadError);
          throw new Error('Failed to upload receipt');
        }
      }

      // Create or update expense
      const expenseData: any = {
        title: formData.title,
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description
      };

      // Only include receipt if a new one was uploaded
      if (receiptPath) {
        expenseData.receipt = receiptPath;
      }

      console.log(editingId ? 'Updating expense data:' : 'Submitting expense data:', expenseData);

      const method = editingId ? 'PUT' : 'POST';
      const endpoint = editingId ? `/expenses/${editingId}` : '/expenses';

      console.log(`Sending ${method} request to:`, endpoint);

      const data = editingId 
        ? await apiPut(endpoint, expenseData)
        : await apiPost(endpoint, expenseData);

      console.log(editingId ? 'Expense updated:' : 'Expense created:', data);
      toast.success(editingId ? 'Expense updated successfully' : 'Expense submitted successfully');
      setOpen(false);
      setEditingId(null);
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

  // Handle edit expense
  const handleEditExpense = (expense: Expense) => {
    console.log('Edit button clicked for expense:', expense._id);
    setEditingId(expense._id);
    setFormData({
      title: expense.title || '',
      category: expense.category,
      amount: expense.amount.toString(),
      date: new Date(expense.date).toISOString().split('T')[0],
      description: expense.description
    });
    setReceiptFile(null);
    setOpen(true);
    console.log('Dialog opened for editing');
  };

  // Handle delete expense
  const handleDeleteExpense = async (expenseId: string) => {
    console.log('Delete button clicked for expense:', expenseId);
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      console.log('Sending DELETE request to:', `/expenses/${expenseId}`);
      
      await apiDelete(`/expenses/${expenseId}`);

      console.log('Delete successful');
      toast.success('Expense deleted successfully');
      await fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete expense');
    }
  };

  // Handle close dialog
  const handleCloseDialog = () => {
    console.log('Closing dialog');
    setOpen(false);
    setEditingId(null);
    setFormData({ title: '', category: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
    setReceiptFile(null);
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedStatus('all');
    setFromDate('');
    setToDate('');
    toast.success('Filters reset');
  };

  // Export expenses to CSV or Excel
  const handleExportExpenses = async (format: 'csv' | 'excel') => {
    try {
      if (filteredExpenses.length === 0) {
        toast.error('No expenses to export');
        return;
      }

      // Prepare data for export
      const exportData = filteredExpenses.map(expense => ({
        'Title': expense.title || '',
        'Category': expense.category || '',
        'Amount': expense.amount || 0,
        'Date': new Date(expense.date).toLocaleDateString('en-IN'),
        'Status': expense.status || '',
        'Description': expense.description || '',
        'Receipt': expense.receipt ? 'Yes' : 'No'
      }));

      if (format === 'csv') {
        // Export as CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join(','),
          ...exportData.map(row =>
            headers.map(header => {
              const value = row[header as keyof typeof row];
              // Escape quotes and wrap in quotes if contains comma
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
        // Export as Excel using a simple approach
        // For production, consider using a library like xlsx
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
      const token = getBearerToken();
      let successCount = 0;
      let failureCount = 0;
      const submitErrors = [];

      console.log(`Importing ${importedExpenses.length} expenses...`);

      for (let idx = 0; idx < importedExpenses.length; idx++) {
        const expense = importedExpenses[idx];
        try {
          const data = await apiPost('/expenses', expense);
          successCount++;
          console.log(`✓ Imported: ${expense.title}`);
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
      // Reset file input
      event.target.value = '';
    }
  };

  // Download template for importing expenses
  const handleDownloadTemplate = () => {
    try {
      // Create sample data with all required columns
      const templateData = [
        {
          'Title': 'Client Meeting Lunch',
          'Category': 'Meals - Business',
          'Amount': 500,
          'Date': new Date().toLocaleDateString('en-IN'),
          'Description': 'Lunch meeting with client ABC'
        },
        {
          'Title': 'Travel - Local Taxi',
          'Category': 'Travel - Local Conveyance',
          'Amount': 250,
          'Date': new Date().toLocaleDateString('en-IN'),
          'Description': 'Taxi to office meeting'
        },
        {
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
    <div className="p-8 space-y-8">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error Loading Expenses</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchExpenses();
              }}
              className="text-red-600 hover:text-red-700 text-sm font-medium mt-2 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Expenses</h1>
          <p className="text-muted-foreground">Track and submit your expense claims</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <ExpenseLimitSettingsDialog readOnly />
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
            <div className="absolute right-0 mt-2 w-36 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-foreground">
              <button
                onClick={() => handleExportExpenses('csv')}
                className="w-full text-left px-4 py-2 hover:bg-muted text-sm rounded-t-lg text-foreground"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExportExpenses('excel')}
                className="w-full text-left px-4 py-2 hover:bg-muted text-sm rounded-b-lg border-t border-border text-foreground"
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

          {/* Add Expense Button */}
          <Dialog open={open} onOpenChange={(newOpen) => {
            console.log('Dialog open state changed to:', newOpen);
            setOpen(newOpen);
            if (!newOpen) {
              handleCloseDialog();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
              <DialogDescription>{editingId ? 'Update your expense claim' : 'Submit a new expense claim with receipt'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Claim Title *</Label>
                <Input 
                  placeholder="e.g., Client Meeting Lunch" 
                  className="rounded-xl mt-2"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                />
                <p className="text-xs text-muted-foreground mt-1">This title will appear in the Expense Claims list</p>
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
                <Label>Upload Receipt (Optional)</Label>
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
                    <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG up to 10MB (optional)</p>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={handleCloseDialog} disabled={submitting}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl" onClick={handleSubmitExpense} disabled={submitting}>
                  {submitting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingId ? 'Update Claim' : 'Submit Claim'}
                </Button>
              </div>
            </div>
            </DialogContent>
          </Dialog>
        </div>
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
            <Input 
              type="date" 
              className="w-[180px] rounded-xl" 
              placeholder="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input 
              type="date" 
              className="w-[180px] rounded-xl" 
              placeholder="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={() => {
              // Filters are already applied automatically
              toast.success('Filters applied');
            }}
          >
            Apply Filters
          </Button>
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={handleResetFilters}
          >
            Reset Filters
          </Button>
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
                        <h4 className="font-semibold">{expense.title || expense.description || 'Expense'}</h4>
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
                  <div className="flex items-center gap-4">
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
                    <div className="flex items-center gap-2">
                      {/* View and Download buttons - always show, disable if no receipt */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl"
                        onClick={() => handleViewReceipt(expense.receipt || '')}
                        disabled={!expense.receipt}
                        title={expense.receipt ? "View receipt" : "No receipt uploaded"}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl"
                        onClick={() => handleDownloadReceipt(expense.receipt || '', expense.title || 'receipt')}
                        disabled={!expense.receipt}
                        title={expense.receipt ? "Download receipt" : "No receipt uploaded"}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                      {/* Edit and Delete buttons for pending expenses */}
                      {expense.status === 'pending' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl"
                            onClick={() => handleEditExpense(expense)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl text-destructive hover:text-destructive"
                            onClick={() => handleDeleteExpense(expense._id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* View Receipt Dialog */}
      <Dialog open={viewReceiptOpen} onOpenChange={setViewReceiptOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>View Receipt</DialogTitle>
            <DialogDescription>
              Receipt preview
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {viewingReceipt && viewingReceipt.trim() && viewingReceipt !== 'undefined' ? (
              <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4">
                {viewingReceipt.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <div className="w-full">
                    <img 
                      src={viewingReceipt} 
                      alt="Receipt" 
                      className="max-w-full h-auto rounded-lg shadow-lg mx-auto"
                      onError={(e) => {
                        console.error('Image load error:', viewingReceipt);
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="text-center py-8">
                              <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              <p class="text-gray-600 mb-4">Receipt file not found</p>
                              <p class="text-sm text-gray-500 mb-4">The receipt file could not be loaded from the server</p>
                            </div>
                          `;
                        }
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
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="text-center py-8">
                              <svg class="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              <p class="text-gray-600 mb-4">PDF file not found</p>
                              <p class="text-sm text-gray-500 mb-4">The receipt file could not be loaded from the server</p>
                            </div>
                          `;
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
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2 font-semibold">No Receipt Available</p>
                <p className="text-sm text-gray-500 mb-6">This expense does not have a receipt attached yet.</p>
                <p className="text-xs text-gray-400 mb-4">To add a receipt, edit this expense and upload a file.</p>
                {viewingReceipt && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-600 break-all">Debug - URL: {viewingReceipt}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl" 
              onClick={() => setViewReceiptOpen(false)}
            >
              Close
            </Button>
            {viewingReceipt && viewingReceipt.trim() && viewingReceipt !== 'undefined' && (
              <Button 
                className="flex-1 rounded-xl" 
                onClick={() => {
                  const fileName = viewingReceipt.substring(viewingReceipt.lastIndexOf('/') + 1);
                  handleDownloadReceipt(viewingReceipt, fileName);
                }}
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

