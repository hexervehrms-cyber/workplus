import { useEffect, useState } from 'react';
import { Settings, IndianRupee, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { apiGet, apiPut } from '../utils/apiHelper';
import { toast } from '../utils/portalToast';

export interface ExpenseLimitsConfig {
  enabled: boolean;
  defaultDailyLimit: number;
  defaultMonthlyLimit: number;
  maxSingleClaim: number;
  maxClaimAgeDays: number;
  requireReceiptAbove: number;
  categoryLimits: Record<string, { dailyLimit?: number; monthlyLimit?: number }>;
}

const DEFAULT_LIMITS: ExpenseLimitsConfig = {
  enabled: true,
  defaultDailyLimit: 5000,
  defaultMonthlyLimit: 50000,
  maxSingleClaim: 25000,
  maxClaimAgeDays: 90,
  requireReceiptAbove: 500,
  categoryLimits: {},
};

interface Props {
  readOnly?: boolean;
  triggerClassName?: string;
}

export function ExpenseLimitSettingsDialog({ readOnly = false, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<ExpenseLimitsConfig>(DEFAULT_LIMITS);

  const loadLimits = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ data?: ExpenseLimitsConfig } | ExpenseLimitsConfig>('/expenses/settings');
      const raw = (res as { data?: ExpenseLimitsConfig })?.data ?? res;
      const data = raw as ExpenseLimitsConfig;
      if (data && typeof data === 'object') {
        setLimits({
          enabled: data.enabled !== false,
          defaultDailyLimit: Number(data.defaultDailyLimit) || DEFAULT_LIMITS.defaultDailyLimit,
          defaultMonthlyLimit: Number(data.defaultMonthlyLimit) || DEFAULT_LIMITS.defaultMonthlyLimit,
          maxSingleClaim: Number(data.maxSingleClaim) || DEFAULT_LIMITS.maxSingleClaim,
          maxClaimAgeDays: Number(data.maxClaimAgeDays) || DEFAULT_LIMITS.maxClaimAgeDays,
          requireReceiptAbove:
            data.requireReceiptAbove !== undefined
              ? Number(data.requireReceiptAbove)
              : DEFAULT_LIMITS.requireReceiptAbove,
          categoryLimits: data.categoryLimits || {},
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load expense limits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void loadLimits();
  }, [open]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiPut('/expenses/settings', limits);
      toast.success('Expense limits saved');
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save expense limits');
    } finally {
      setSaving(false);
    }
  };

  const num = (key: keyof ExpenseLimitsConfig, fallback: number) => {
    const v = limits[key];
    return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName || 'rounded-xl'}>
          <Settings className="w-4 h-4 mr-2" />
          {readOnly ? 'View limits' : 'Expense settings'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Expense policy limits' : 'Expense limit settings'}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? 'These limits apply when you submit expense claims. Amounts are in INR (₹).'
              : 'Set organization-wide daily, monthly, and per-claim limits for all employees.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {!readOnly && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="limits-enabled">Enforce expense limits</Label>
                <Switch
                  id="limits-enabled"
                  checked={limits.enabled}
                  onCheckedChange={(checked) => setLimits((p) => ({ ...p, enabled: checked }))}
                />
              </div>
            )}

            {readOnly && !limits.enabled && (
              <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">
                Expense limits are not currently enforced for your organization.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ['defaultDailyLimit', 'Default daily limit (₹)', limits.defaultDailyLimit],
                  ['defaultMonthlyLimit', 'Default monthly limit (₹)', limits.defaultMonthlyLimit],
                  ['maxSingleClaim', 'Max single claim (₹)', limits.maxSingleClaim],
                  ['maxClaimAgeDays', 'Max claim age (days)', limits.maxClaimAgeDays],
                  ['requireReceiptAbove', 'Receipt required above (₹)', limits.requireReceiptAbove],
                ] as const
              ).map(([key, label, value]) => (
                <div key={key} className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {label.includes('₹') && <IndianRupee className="w-3 h-3" />}
                    {label.replace(' (₹)', '')}
                  </Label>
                  {readOnly ? (
                    <p className="text-sm font-semibold text-foreground">
                      {key === 'maxClaimAgeDays'
                        ? value
                        : `₹${Number(value).toLocaleString('en-IN')}`}
                    </p>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      disabled={!limits.enabled}
                      value={num(key, DEFAULT_LIMITS[key] as number)}
                      onChange={(e) =>
                        setLimits((p) => ({
                          ...p,
                          [key]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Category-specific limits can be configured by your administrator in organization settings.
              Claims are validated against daily and monthly totals per category.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {!readOnly && (
            <Button onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save limits
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
