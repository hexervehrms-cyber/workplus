import { Check, Sparkles } from 'lucide-react';
import { Card } from './ui/card';

const features = [
  'Super Admin Control Room with global analytics',
  'Admin Dashboard for organization management',
  'Employee Portal with comprehensive modules',
  'Dark & Light mode support',
  'Role-based access control',
  'Leave & Attendance management',
  'Performance tracking & KPIs',
  'Payroll & Expense management',
  'Real-time chat system',
  'Interactive charts & analytics',
];

export function FeatureShowcase() {
  return (
    <Card className="p-6 rounded-2xl border-2 border-primary/20">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-3">Platform Features</h3>
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
