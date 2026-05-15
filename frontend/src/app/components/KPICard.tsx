import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './ui/card';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'accent' | 'destructive';
  onClick?: () => void;
  /** Stronger border/ring when showing live operational counts (e.g. checked-in / on break). */
  emphasize?: boolean;
}

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  destructive: 'bg-destructive/10 text-destructive'
};

export function KPICard({ title, value, change, icon: Icon, color = 'primary', onClick, emphasize }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;
  const numeric = typeof value === 'number' ? value : parseInt(String(value), 10);
  const showEmphasis =
    emphasize && !Number.isNaN(numeric) && numeric > 0;

  return (
    <Card
      className={`p-6 rounded-2xl border border-border/50 backdrop-blur-sm transition-all duration-300 kpi-card card-hover frame-motion ${
        showEmphasis ? 'ring-2 ring-primary/35 border-primary/30' : ''
      } ${onClick ? 'cursor-pointer' : ''}`}
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
