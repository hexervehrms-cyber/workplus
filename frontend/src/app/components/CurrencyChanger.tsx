import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ChevronDown, Globe, Search, Check, IndianRupee } from 'lucide-react';

const CurrencyChanger: React.FC = () => {
  const { currencies, selectedCurrency, setSelectedCurrency, formatCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const popularCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'SGD'];

  const filteredCurrencies = currencies.filter(currency =>
    currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.symbol.includes(searchTerm)
  );

  const handleCurrencySelect = (currency: any) => {
    setSelectedCurrency(currency);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl hover:bg-accent"
      >
        {selectedCurrency.code === 'INR' ? (
          <IndianRupee className="w-4 h-4" />
        ) : (
          <Globe className="w-4 h-4" />
        )}
        <span className="font-medium">{selectedCurrency.code}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Content */}
          <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto z-50 rounded-xl shadow-lg border">
            <div className="p-4">
              {/* Current Selection */}
              <div className="mb-4 p-3 rounded-lg bg-accent/50 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedCurrency.code === 'INR' ? (
                      <IndianRupee className="w-5 h-5 text-primary" />
                    ) : (
                      <span className="text-lg font-bold">{selectedCurrency.symbol}</span>
                    )}
                    <div>
                      <div className="font-medium">{selectedCurrency.code}</div>
                      <div className="text-xs text-muted-foreground">{selectedCurrency.name}</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    {formatCurrency(1000)}
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search currency..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Popular Currencies */}
              {!searchTerm && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Popular</div>
                  <div className="grid grid-cols-3 gap-2">
                    {popularCurrencies.map(code => {
                      const currency = currencies.find(c => c.code === code);
                      if (!currency) return null;
                      const isSelected = selectedCurrency.code === currency.code;
                      return (
                        <Button
                          key={code}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleCurrencySelect(currency)}
                          className={`text-xs rounded-lg flex items-center gap-1 ${isSelected ? 'bg-primary text-primary-foreground' : ''}`}
                        >
                          {currency.code === 'INR' ? (
                            <IndianRupee className="w-3 h-3" />
                          ) : (
                            <span className="font-medium">{currency.code}</span>
                          )}
                          {isSelected && <Check className="w-3 h-3 ml-auto" />}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Currencies */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">All Currencies</div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredCurrencies.slice(0, 20).map((currency) => {
                    const isSelected = selectedCurrency.code === currency.code;
                    return (
                      <div
                        key={currency.code}
                        onClick={() => handleCurrencySelect(currency)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {currency.code === 'INR' ? (
                            <IndianRupee className="w-4 h-4 text-primary" />
                          ) : (
                            <span className="text-sm font-bold">{currency.symbol}</span>
                          )}
                          <div>
                            <div className="text-sm font-medium">{currency.code}</div>
                            <div className="text-xs text-muted-foreground">{currency.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-medium">
                            {formatCurrency(100)}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredCurrencies.length > 20 && (
                  <div className="text-xs text-muted-foreground mt-2 text-center">
                    ... and {filteredCurrencies.length - 20} more
                  </div>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default CurrencyChanger;
