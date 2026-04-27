import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Receipt, Search, Filter, Download, Eye, CheckCircle, AlertCircle, Tag, Car, Utensils, Home, Briefcase, Plane, Heart, Book, ShoppingCart, Coffee, IndianRupee } from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

interface Expense {
  id: number;
  employee: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
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
        <span>{formatCurrency(amount).replace('â¨', '')}</span>
      </div>
    );
  }
  
  return <span className={className}>{formatCurrency(amount)}</span>;
};

export default function ExpensesAdmin() {
  const { formatCurrency } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: 1, employee: 'John Smith', category: 'Travel', description: 'Client meeting travel', amount: 250.00, date: '2024-04-15', status: 'Approved' },
    { id: 2, employee: 'Sarah Johnson', category: 'Food', description: 'Team lunch', amount: 85.50, date: '2024-04-14', status: 'Pending' },
    { id: 3, employee: 'Mike Chen', category: 'Office', description: 'Office supplies', amount: 120.00, date: '2024-04-13', status: 'Approved' },
    { id: 4, employee: 'Emma Wilson', category: 'Home', description: 'Home office setup', amount: 450.00, date: '2024-04-12', status: 'Rejected' },
    { id: 5, employee: 'David Brown', category: 'Entertainment', description: 'Client entertainment', amount: 200.00, date: '2024-04-11', status: 'Pending' },
    { id: 6, employee: 'Lisa Garcia', category: 'Health', description: 'Medical expenses', amount: 150.00, date: '2024-04-10', status: 'Approved' },
    { id: 7, employee: 'Tom Anderson', category: 'Education', description: 'Training course', amount: 300.00, date: '2024-04-09', status: 'Pending' },
    { id: 8, employee: 'Amy Davis', category: 'Shopping', description: 'Equipment purchase', amount: 75.00, date: '2024-04-08', status: 'Approved' }
  ]);

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Manage employee expense claims</p>
        </div>
        <Button className="rounded-xl">
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
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xl font-bold">18</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">124</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <CurrencyAmount amount={45678} className="text-xl font-bold" />
              <p className="text-sm text-muted-foreground">Total This Month</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-xl">
        <div className="overflow-x-auto">
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
                  <tr key={expense.id} className="border-b hover:bg-accent/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">{expense.employee.split(' ').map(n => n[0]).join('')}</span>
                        </div>
                        <div>
                          <p className="font-medium">{expense.employee}</p>
                          <p className="text-sm text-muted-foreground">{expense.employee.toLowerCase().replace(' ', '')}@company.com</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium">{expense.description}</p>
                    </td>
                    <td className="p-4">
                      <Badge className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(expense.category)}`}>
                        <CategoryIcon className="w-3 h-3 mr-1" />
                        {expense.category}
                      </Badge>
                    </td>
                    <td className="p-4 font-medium"><CurrencyAmount amount={expense.amount} /></td>
                    <td className="p-4">
                      <p className="font-medium">{expense.date}</p>
                      <p className="text-sm text-muted-foreground">
                        {Math.floor((new Date().getTime() - new Date(expense.date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                      </p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        expense.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        expense.status === 'Approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
