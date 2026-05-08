import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Settings, Loader2, Save } from 'lucide-react';
import { LeaveTypeSettingsService } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Label } from '../../components/ui/label';

interface LeaveTypeSettings {
  _id: string;
  orgId: string;
  enabledLeaveTypes: {
    vacation: boolean;
    sickLeave: boolean;
    casualLeave: boolean;
    earnedLeave: boolean;
    medicalLeave: boolean;
    maternityLeave: boolean;
    paternityLeave: boolean;
    compensatoryOff: boolean;
    personal: boolean;
    emergency: boolean;
    ncns: boolean;
    sandwichLeave: boolean;
  };
}

const LEAVE_TYPE_OPTIONS = [
  { key: 'vacation', label: 'Vacation', description: 'Annual vacation days' },
  { key: 'sickLeave', label: 'Sick Leave', description: 'Medical sick days' },
  { key: 'casualLeave', label: 'Casual Leave', description: 'General casual leave' },
  { key: 'earnedLeave', label: 'Earned Leave', description: 'Earned leave days' },
  { key: 'medicalLeave', label: 'Medical Leave', description: 'Extended medical leave' },
  { key: 'maternityLeave', label: 'Maternity Leave', description: 'Maternity leave for mothers' },
  { key: 'paternityLeave', label: 'Paternity Leave', description: 'Paternity leave for fathers' },
  { key: 'compensatoryOff', label: 'Compensatory Off', description: 'Comp off for overtime work' },
  { key: 'personal', label: 'Personal Leave', description: 'Personal time off' },
  { key: 'emergency', label: 'Emergency Leave', description: 'Emergency situations' },
  { key: 'ncns', label: 'NCNS (No Call No Show)', description: 'Unplanned absences' },
  { key: 'sandwichLeave', label: 'Sandwich Leave', description: 'Leave between holidays' }
];

export default function LeaveSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<LeaveTypeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabledLeaveTypes, setEnabledLeaveTypes] = useState({
    vacation: true,
    sickLeave: true,
    casualLeave: true,
    earnedLeave: true,
    medicalLeave: true,
    maternityLeave: false,
    paternityLeave: false,
    compensatoryOff: true,
    personal: false,
    emergency: false,
    ncns: false,
    sandwichLeave: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      let orgId = user?.orgId || user?.tenantId;
      if (!orgId) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            orgId = parsedUser.orgId || parsedUser.tenantId || 'system';
          } catch (e) {
            orgId = 'system';
          }
        } else {
          orgId = 'system';
        }
      }

      const response = await LeaveTypeSettingsService.getSettings(orgId);
      if (response.success && response.data) {
        setSettings(response.data);
        setEnabledLeaveTypes(response.data.enabledLeaveTypes);
      }
    } catch (error) {
      console.error('Error fetching leave settings:', error);
      toast.error('Failed to load leave settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLeaveType = (leaveType: string) => {
    setEnabledLeaveTypes(prev => ({
      ...prev,
      [leaveType]: !prev[leaveType as keyof typeof prev]
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      let orgId = user?.orgId || user?.tenantId;
      if (!orgId) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            orgId = parsedUser.orgId || parsedUser.tenantId || 'system';
          } catch (e) {
            orgId = 'system';
          }
        } else {
          orgId = 'system';
        }
      }

      const response = await LeaveTypeSettingsService.updateSettings(
        orgId,
        enabledLeaveTypes,
        user?.userId || user?.id
      );

      if (response.success) {
        toast.success('Leave settings updated successfully');
        fetchSettings();
      }
    } catch (error) {
      console.error('Error saving leave settings:', error);
      toast.error('Failed to save leave settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Settings</h1>
          <p className="text-muted-foreground">Configure which leave types are available for employees</p>
        </div>
        <Button 
          onClick={handleSaveSettings}
          disabled={saving}
          className="rounded-xl bg-primary hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      <Card className="p-6 rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <p>Loading leave settings...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Available Leave Types</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LEAVE_TYPE_OPTIONS.map((option) => (
                <div key={option.key} className="flex items-start gap-3 p-4 border border-foreground/10 rounded-xl hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    id={option.key}
                    checked={enabledLeaveTypes[option.key as keyof typeof enabledLeaveTypes]}
                    onChange={() => handleToggleLeaveType(option.key)}
                    className="w-5 h-5 rounded cursor-pointer mt-0.5"
                  />
                  <div className="flex-1">
                    <label htmlFor={option.key} className="cursor-pointer">
                      <div className="font-medium text-foreground">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-xl">
              <h4 className="font-medium text-foreground mb-2">Note:</h4>
              <p className="text-sm text-muted-foreground">
                Only checked leave types will be visible to employees in their dashboard and leave request forms. 
                Unchecked leave types will be hidden from the employee portal but existing allocations will remain intact.
              </p>
            </div>

            <div className="mt-6">
              <h4 className="font-medium text-foreground mb-3">Currently Enabled Leave Types:</h4>
              <div className="flex flex-wrap gap-2">
                {LEAVE_TYPE_OPTIONS.filter(option => 
                  enabledLeaveTypes[option.key as keyof typeof enabledLeaveTypes]
                ).map(option => (
                  <span key={option.key} className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-sm font-medium">
                    {option.label}
                  </span>
                ))}
              </div>
              {LEAVE_TYPE_OPTIONS.filter(option => 
                enabledLeaveTypes[option.key as keyof typeof enabledLeaveTypes]
              ).length === 0 && (
                <p className="text-sm text-muted-foreground">No leave types enabled</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}