import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './ui/card';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'accent' | 'destructive';
  onClick?: () => void;
}

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  destructive: 'bg-destructive/10 text-destructive'
};

export function KPICard({ title, value, change, icon: Icon, color = 'primary', onClick }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card
      className={`p-6 rounded-2xl border border-border/50 backdrop-blur-sm transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:scale-105 hover:border-primary/50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <h3 className="text-3xl font-bold text-foreground mb-2">{value}</h3>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-secondary' : 'text-destructive'}`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{Math.abs(change)}%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}
