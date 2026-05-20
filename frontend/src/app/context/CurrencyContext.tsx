import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { userCurrencyKey } from '../utils/userScopedStorage';
import { apiGet, apiRequest } from '../utils/apiHelper';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
}

interface CurrencyContextType {
  currencies: Currency[];
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  convertAmount: (amount: number, fromCurrency?: string, toCurrency?: string) => number;
  formatCurrency: (amount: number, currency?: Currency) => string;
  loading: boolean;
}

const currencies: Currency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 1 },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.0134 },
  { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.0114 },
  { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.0098 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', exchangeRate: 1.48 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', exchangeRate: 0.086 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', exchangeRate: 0.0168 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchangeRate: 0.0181 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', exchangeRate: 0.0123 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', exchangeRate: 0.0181 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', exchangeRate: 0.105 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', exchangeRate: 0.115 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', exchangeRate: 0.114 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', exchangeRate: 0.085 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zl', exchangeRate: 0.052 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.049 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', exchangeRate: 0.050 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', exchangeRate: 0.0195 },
];

const defaultInr = currencies.find((c) => c.code === 'INR')!;

const APP_DEFAULT_CURRENCY = 'INR';

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

function resolveCurrency(code: string | null | undefined): Currency {
  if (!code) return defaultInr;
  return currencies.find((c) => c.code === code) || defaultInr;
}

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const currencyStorageKey = userCurrencyKey(user?.id);
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>(defaultInr);
  const [loading, setLoading] = useState(true);

  const persistCurrency = useCallback(async (currency: Currency) => {
    setSelectedCurrencyState(currency);
    try {
      localStorage.setItem(currencyStorageKey, currency.code);
    } catch (error) {
      console.error('Error saving currency preference:', error);
    }

    if (!isAuthenticated) return;

    try {
      await apiRequest('/currency/preference', {
        method: 'PUT',
        body: JSON.stringify({ currencyCode: currency.code }),
      });
    } catch (error) {
      console.error('Error syncing currency to server:', error);
    }
  }, [isAuthenticated, currencyStorageKey]);

  const setSelectedCurrency = (currency: Currency) => {
    void persistCurrency(currency);
  };

  const loadCurrencyPreference = useCallback(async () => {
    setLoading(true);
    try {
      if (isAuthenticated) {
        const data = await apiGet<{ success?: boolean; data?: { currencyCode?: string } }>(
          '/currency/preference',
          false
        );
        const code = data?.data?.currencyCode || APP_DEFAULT_CURRENCY;
        setSelectedCurrencyState(resolveCurrency(code));
        localStorage.setItem(currencyStorageKey, code);
        return;
      }

      const savedCurrency = localStorage.getItem(currencyStorageKey);
      setSelectedCurrencyState(resolveCurrency(savedCurrency || APP_DEFAULT_CURRENCY));
    } catch (error) {
      console.error('Error loading currency preference:', error);
      setSelectedCurrencyState(defaultInr);
      localStorage.setItem(currencyStorageKey, APP_DEFAULT_CURRENCY);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currencyStorageKey]);

  useEffect(() => {
    void loadCurrencyPreference();
  }, [loadCurrencyPreference]);

  const convertAmount = (amount: number, fromCurrency?: string, toCurrency?: string): number => {
    const from = currencies.find((c) => c.code === fromCurrency) || selectedCurrency;
    const to = currencies.find((c) => c.code === toCurrency) || selectedCurrency;

    if (!from || !to) return amount;

    const amountInInr = amount / from.exchangeRate;
    return amountInInr * to.exchangeRate;
  };

  const formatCurrency = (amount: number, currency?: Currency): string => {
    const curr = currency || selectedCurrency;
    if (curr.code === 'INR') {
      return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${curr.symbol}${amount.toFixed(2)}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currencies,
        selectedCurrency,
        setSelectedCurrency,
        convertAmount,
        formatCurrency,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}
