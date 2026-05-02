import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // Rate relative to USD
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
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1 },
  { code: 'EUR', name: 'Euro', symbol: 'â¬', exchangeRate: 0.85 },
  { code: 'GBP', name: 'British Pound', symbol: 'Â£', exchangeRate: 0.73 },
  { code: 'JPY', name: 'Japanese Yen', symbol: 'Â¥', exchangeRate: 110.5 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: 'Â¥', exchangeRate: 6.45 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 74.5 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', exchangeRate: 1.25 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchangeRate: 1.35 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', exchangeRate: 0.92 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', exchangeRate: 1.35 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', exchangeRate: 7.8 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', exchangeRate: 8.6 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', exchangeRate: 8.5 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', exchangeRate: 6.3 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zÅ', exchangeRate: 3.9 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'KÄ', exchangeRate: 21.5 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', exchangeRate: 310 },
  { code: 'RUB', name: 'Russian Ruble', symbol: 'â½', exchangeRate: 73 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', exchangeRate: 5.2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', exchangeRate: 20 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', exchangeRate: 15 },
  { code: 'KRW', name: 'South Korean Won', symbol: 'â©', exchangeRate: 1180 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', exchangeRate: 14300 },
  { code: 'THB', name: 'Thai Baht', symbol: 'à¸¿', exchangeRate: 33 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', exchangeRate: 4.2 },
  { code: 'PHP', name: 'Philippine Peso', symbol: 'â±', exchangeRate: 50 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: 'â«', exchangeRate: 23000 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ï·¼', exchangeRate: 3.75 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'Ø¯.Ø¥', exchangeRate: 3.67 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'EÂ£', exchangeRate: 15.7 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: 'â¦', exchangeRate: 410 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', exchangeRate: 110 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GHâµ', exchangeRate: 6.1 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', exchangeRate: 2320 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', exchangeRate: 3600 },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RWF', exchangeRate: 1000 },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P', exchangeRate: 11.2 },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', exchangeRate: 16.5 },
  { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', exchangeRate: 15.2 },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', exchangeRate: 63 },
  { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', exchangeRate: 650 },
  { code: 'XAF', name: 'CFA Franc BEAC', symbol: 'FCFA', exchangeRate: 550 },
  { code: 'XOF', name: 'CFA Franc BCEAO', symbol: 'CFA', exchangeRate: 550 },
  { code: 'XPF', name: 'CFP Franc', symbol: 'Fr', exchangeRate: 100 },
  { code: 'SCR', name: 'Seychellois Rupee', symbol: 'â¨', exchangeRate: 13.5 },
  { code: 'MUR', name: 'Mauritian Rupee', symbol: 'â¨', exchangeRate: 43 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'â¨', exchangeRate: 200 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'â¨', exchangeRate: 160 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: 'à§³', exchangeRate: 85 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'â¨', exchangeRate: 120 },
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', exchangeRate: 1650 },
  { code: 'LAK', name: 'Lao Kip', symbol: 'â­', exchangeRate: 10000 },
  { code: 'KHR', name: 'Cambodian Riel', symbol: 'áÛ', exchangeRate: 4100 },
  { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', exchangeRate: 100 },
  { code: 'WST', name: 'Samoan Tala', symbol: 'SAT', exchangeRate: 2.5 },
  { code: 'TOP', name: 'Tongan PaÊ»anga', symbol: 'T$', exchangeRate: 2.3 },
  { code: 'FJD', name: 'Fijian Dollar', symbol: 'F$', exchangeRate: 2.1 },
  { code: 'PGK', name: 'Papua New Guinea Kina', symbol: 'K', exchangeRate: 3.5 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', exchangeRate: 1.45 },
];

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currencies[0]); // Default to USD
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user's currency preference from localStorage or API
    const loadCurrencyPreference = async () => {
      try {
        const savedCurrency = localStorage.getItem('userCurrency');
        if (savedCurrency) {
          const currency = currencies.find(c => c.code === savedCurrency);
          if (currency) {
            setSelectedCurrency(currency);
          }
        }
      } catch (error) {
        console.error('Error loading currency preference:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCurrencyPreference();
  }, []);

  const handleSetSelectedCurrency = (currency: Currency) => {
    setSelectedCurrency(currency);
    localStorage.setItem('userCurrency', currency.code);
    
    // In production, you would also save to backend API
    // await fetch('/api/user/currency', {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ currencyCode: currency.code })
    // });
  };

  const convertAmount = (amount: number, fromCurrency: string = 'USD', toCurrency?: string): number => {
    const from = currencies.find(c => c.code === fromCurrency);
    const to = toCurrency ? currencies.find(c => c.code === toCurrency) : selectedCurrency;
    
    if (!from || !to) return amount;
    
    // Convert to USD first, then to target currency
    const amountInUSD = amount / from.exchangeRate;
    return amountInUSD * to.exchangeRate;
  };

  const formatCurrency = (amount: number, currency?: Currency): string => {
    const curr = currency || selectedCurrency;
    const convertedAmount = currency ? amount : convertAmount(amount);
    
    // Fallback for symbols that might not display correctly
    const getSafeSymbol = (code: string, symbol: string) => {
      const symbolMap: Record<string, string> = {
        'INR': '₹',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'CNY': '¥',
        'KRW': '₩',
        'THB': '฿',
        'VND': '₫',
        'SAR': '﷼',
        'AED': 'د.إ',
        'EGP': 'E£',
        'NGN': '₦',
        'GHS': 'GH₵',
        'LKR': '₨',
        'PKR': '₨',
        'BDT': '৳',
        'NPR': '₨',
        'MMK': 'K',
        'LAK': '₭',
        'KHR': 'riel',
        'MUR': '₨',
        'SCR': '₨',
        'AOA': 'Kz',
        'XAF': 'FCFA',
        'XOF': 'CFA',
        'XPF': 'Fr'
      };
      
      return symbolMap[code] || symbol || code;
    };
    
    const safeSymbol = getSafeSymbol(curr.code, curr.symbol);
    
    // Format based on currency code
    switch (curr.code) {
      case 'JPY':
      case 'KRW':
      case 'VND':
      case 'CLP':
      case 'COP':
      case 'PYG':
      case 'UGX':
      case 'RWF':
      case 'XPF':
      case 'XAF':
      case 'XOF':
      case 'VUV':
        // No decimal places for these currencies
        return `${safeSymbol}${convertedAmount.toFixed(0)}`;
      
      case 'BHD':
      case 'KWD':
      case 'OMR':
      case 'TND':
      case 'LYD':
        // 3 decimal places for these currencies
        return `${safeSymbol}${convertedAmount.toFixed(3)}`;
      
      default:
        // 2 decimal places for most currencies
        return `${safeSymbol}${convertedAmount.toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currencies,
        selectedCurrency,
        setSelectedCurrency: handleSetSelectedCurrency,
        convertAmount,
        formatCurrency,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
