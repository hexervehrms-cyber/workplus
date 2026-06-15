import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Search, Globe, Check } from 'lucide-react';

interface CurrencySelectorProps {
  onClose?: () => void;
  showSaveButton?: boolean;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({ onClose, showSaveButton = false }) => {
  const { currencies, selectedCurrency, setSelectedCurrency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTempCurrency, setSelectedTempCurrency] = useState(selectedCurrency);

  const filteredCurrencies = currencies.filter(currency =>
    currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.symbol.includes(searchTerm)
  );

  const popularCurrencies = [
    'INR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'SGD'
  ];

  const groupedCurrencies = filteredCurrencies.reduce((groups, currency) => {
    const firstLetter = currency.code[0];
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(currency);
    return groups;
  }, {} as Record<string, typeof currencies>);

  const handleSave = () => {
    setSelectedCurrency(selectedTempCurrency);
    if (onClose) onClose();
  };

  const sampleAmount = 1000;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Currency Settings</h3>
              <p className="text-sm text-muted-foreground">Choose your preferred currency</p>
            </div>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
              ×
            </Button>
          )}
        </div>

        {/* Current Selection */}
        <div className="mb-6 p-4 rounded-xl bg-accent/50 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-muted-foreground">Currently Selected</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold">{selectedCurrency.symbol}</span>
                <span className="font-semibold">{selectedCurrency.code}</span>
                <span className="text-muted-foreground">- {selectedCurrency.name}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Example:</div>
              <div className="font-semibold">{formatCurrency(sampleAmount)}</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search currency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        {/* Popular Currencies */}
        {!searchTerm && (
          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">Popular Currencies</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {popularCurrencies.map(code => {
                const currency = currencies.find(c => c.code === code);
                if (!currency) return null;
                const isSelected = selectedTempCurrency.code === currency.code;
                return (
                  <Button
                    key={code}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTempCurrency(currency)}
                    className={`rounded-xl justify-start ${isSelected ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    <span className="font-medium">{currency.code}</span>
                    {isSelected && <Check className="w-4 h-4 ml-auto" />}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* All Currencies */}
        <div className="max-h-96 overflow-y-auto">
          <Label className="text-sm font-medium mb-3 block">All Currencies</Label>
          <div className="space-y-1">
            {Object.entries(groupedCurrencies)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([letter, currencyGroup]) => (
                <div key={letter}>
                  <div className="sticky top-0 bg-background py-2 px-3 text-sm font-medium text-muted-foreground border-b border-border">
                    {letter}
                  </div>
                  {currencyGroup.map((currency) => {
                    const isSelected = selectedTempCurrency.code === currency.code;
                    return (
                      <div
                        key={currency.code}
                        onClick={() => setSelectedTempCurrency(currency)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                            <span className="text-sm font-bold">{currency.symbol}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{currency.code}</span>
                              {popularCurrencies.includes(currency.code) && (
                                <Badge variant="secondary" className="text-xs">Popular</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{currency.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(sampleAmount)}</div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary mx-auto mt-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </div>

        {/* Action Buttons */}
        {showSaveButton && (
          <div className="flex gap-3 mt-6 pt-6 border-t border-border">
            <Button onClick={handleSave} className="flex-1 rounded-xl">
              Save Currency Preference
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose} className="rounded-xl">
                Cancel
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CurrencySelector;
