import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TokenManager } from '../app/utils/api';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  decimalPlaces: number;
  name: string;
}

interface CurrencyContextType {
  currency: CurrencyConfig;
  setCurrency: (currency: CurrencyConfig) => void;
  updateCurrency: (currencyCode: string) => Promise<void>;
  formatCurrency: (amount: number) => string;
  loading: boolean;
  error: string | null;
}

const defaultCurrency: CurrencyConfig = {
  code: 'INR',
  symbol: '₹',
  decimalPlaces: 2,
  name: 'Indian Rupee'
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyConfig>(defaultCurrency);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load currency preference from backend
  const loadCurrencyPreference = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = TokenManager.get();
      const response = await fetch('/api/currency/preference', {
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load currency preference');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setCurrencyState({
          code: data.data.currencyCode || 'INR',
          symbol: data.data.currencySymbol || '₹',
          decimalPlaces: data.data.decimalPlaces || 2,
          name: data.data.name || 'Indian Rupee'
        });

        // Persist to localStorage
        localStorage.setItem('currency', JSON.stringify(data.data));
      }
    } catch (err) {
      console.error('Error loading currency preference:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // Try to load from localStorage as fallback
      const cached = localStorage.getItem('currency');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setCurrencyState({
            code: parsed.currencyCode || 'INR',
            symbol: parsed.currencySymbol || '₹',
            decimalPlaces: parsed.decimalPlaces || 2,
            name: parsed.name || 'Indian Rupee'
          });
        } catch (e) {
          console.warn('Failed to parse cached currency');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Update currency preference
  const updateCurrency = useCallback(async (currencyCode: string) => {
    try {
      setLoading(true);
      setError(null);

      const token = TokenManager.get();
      const response = await fetch('/api/currency/preference', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currencyCode })
      });

      if (!response.ok) {
        throw new Error('Failed to update currency preference');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setCurrencyState({
          code: data.data.currencyCode || 'INR',
          symbol: data.data.currencySymbol || '₹',
          decimalPlaces: data.data.decimalPlaces || 2,
          name: data.data.name || 'Indian Rupee'
        });

        // Persist to localStorage
        localStorage.setItem('currency', JSON.stringify(data.data));
      }
    } catch (err) {
      console.error('Error updating currency preference:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Format currency amount
  const formatCurrency = useCallback((amount: number): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return `${currency.symbol}0.00`;
    }

    const formatted = amount.toLocaleString('en-IN', {
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces
    });

    return `${currency.symbol}${formatted}`;
  }, [currency]);

  // Load currency on mount
  useEffect(() => {
    void loadCurrencyPreference();
  }, [loadCurrencyPreference]);

  const value: CurrencyContextType = {
    currency,
    setCurrency: setCurrencyState,
    updateCurrency,
    formatCurrency,
    loading,
    error
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};
