import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../../components/ui/command';
import { Plus, Edit, Trash2, Download, Check, X, Loader, ChevronsUpDown, Eye } from 'lucide-react';
import { toast } from '../../utils/portalToast';
import { cn } from '../../components/ui/utils';
import { apiGet, apiPost, apiPut, apiDelete, apiFetchBlob, appendOrgIdParam, resolveAuthOrgId } from '../../utils/apiHelper';
import { ensureAccessToken } from '../../utils/sessionAuth';
import { useAuth } from '../../context/AuthContext';
import { OrgRequiredNotice } from '../../components/OrgRequiredNotice';
import { ensureArray, safeFormatInr } from '../../utils/safeUi';

interface SalaryStructure {
  _id: string;
  employeeId: string;
  employeeName: string;
  employeeType: string;
  status: string;
  grossEarnings: number;
  netSalary: number;
  approvalDate?: string;
}

interface SalaryField {
  name: string;
  amount: number;
  description?: string;
}

interface SalarySlip {
  _id: string;
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  status: string;
  grossEarnings: number;
  totalDeductions?: number;
  netSalary: number;
  approvalDate?: string;
  earnings?: {
    basic?: number;
    hra?: number;
    medicalExpenses?: number;
    travel?: number;
    internetCharges?: number;
    nightShiftAllowance?: number;
    incentives?: number;
    bonus?: number;
    commission?: number;
    otherEarnings?: Array<{ name: string; amount: number }>;
  };
  deductions?: {
    providentFund?: number;
    employeeStateInsurance?: number;
    professionalTax?: number;
    incomeTax?: number;
    leaveDeduction?: number;
    otherDeductions?: Array<{ name: string; amount: number }>;
  };
  attendanceData?: {
    totalWorkingDays?: number;
    presentDays?: number;
    absentDays?: number;
    leavesTaken?: number;
    halfDays?: number;
  };
}

async function fetchSalarySlipBlob(slipId: string): Promise<Blob> {
  return apiFetchBlob(`salary/slip/${slipId}/download`, {
    headers: { Accept: 'text/html,application/pdf,*/*' },
  });
}

type PayrollEmployeeOption = {
  _id: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
  userId?: { name?: string; email?: string } | string;
};

function payrollEmployeeId(emp: { _id?: unknown; id?: unknown }): string {
  return String(emp._id ?? emp.id ?? '');
}

function payrollEmployeeLabel(emp: PayrollEmployeeOption): string {
  if (emp.firstName || emp.lastName) {
    return [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
  }
  const u = emp.userId;
  if (u && typeof u === 'object' && u.name) return u.name;
  if (emp.employeeCode) return emp.employeeCode;
  return 'Employee';
}

export default function Payroll() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'structure' | 'slips'>('structure');
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStructureDialog, setShowStructureDialog] = useState(false);
  const [showGenerateSlipDialog, setShowGenerateSlipDialog] = useState(false);
  const [showViewSlipDialog, setShowViewSlipDialog] = useState(false);
  const [viewingSlip, setViewingSlip] = useState<SalarySlip | null>(null);
  const [viewSlipLoading, setViewSlipLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeeType, setEmployeeType] = useState('employee');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  
  // Salary slip generation fields
  const [slipEmployeeId, setSlipEmployeeId] = useState('');
  const [slipMonth, setSlipMonth] = useState(new Date().getMonth() + 1);
  const [slipYear, setSlipYear] = useState(new Date().getFullYear());
  const [slipGenerating, setSlipGenerating] = useState(false);
  const [slipGenerateError, setSlipGenerateError] = useState<{ code?: string; message?: string; employeeName?: string } | null>(null);

  // Bulk generation fields
  const [showBulkGenerateDialog, setShowBulkGenerateDialog] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(new Date().getMonth() + 1);
  const [bulkYear, setBulkYear] = useState(new Date().getFullYear());
  const [bulkAllEmployees, setBulkAllEmployees] = useState(true);
  const [bulkSelectedEmployees, setBulkSelectedEmployees] = useState<string[]>([]);
  const [bulkSkipExisting, setBulkSkipExisting] = useState(true);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [showBulkResult, setShowBulkResult] = useState(false);
  
  // Popover states
  const [openStructureEmployeePopover, setOpenStructureEmployeePopover] = useState(false);
  const [openSlipEmployeePopover, setOpenSlipEmployeePopover] = useState(false);
  
  // Earnings fields
  const [earnings, setEarnings] = useState({
    basic: 0,
    hra: 0,
    medicalExpenses: 0,
    travel: 0,
    internetCharges: 0,
    nightShiftAllowance: 0,
    incentives: 0,
    bonus: 0,
    commission: 0,
    otherEarnings: [] as SalaryField[]
  });

  // Deductions fields - all start at 0, no defaults
  const [deductions, setDeductions] = useState({
    providentFund: 0,
    employeeStateInsurance: 0,
    professionalTax: 0,
    incomeTax: 0,
    otherDeductions: [] as SalaryField[]
  });

  const [employees, setEmployees] = useState<PayrollEmployeeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [autoCalculateEnabled, setAutoCalculateEnabled] = useState(false);
  const [ctc, setCtc] = useState(0);

  // Calculate basic salary from CTC
  const handleCtcChange = (ctcValue: number) => {
    setCtc(ctcValue);
    
    if (ctcValue > 0) {
      // Basic salary is typically 40-50% of CTC
      // Using 45% as standard for Indian salary structure
      const calculatedBasic = Math.round(ctcValue * 0.45);
      setEarnings({ ...earnings, basic: calculatedBasic });
    }
  };

  // Auto-calculate salary parameters based on CTC
  const handleAutoCalculate = () => {
    if (ctc <= 0) {
      toast.error('Please enter a valid CTC first');
      return;
    }

    // CTC = Gross Earnings (all earnings components)
    // Net Salary = CTC - Deductions
    // Therefore: CTC = Net Salary + Deductions

    // Step 1: Calculate basic salary as 45% of CTC
    const basicSalary = Math.round(ctc * 0.45);

    // Step 2: Calculate other fixed allowances
    const hra = Math.round(basicSalary * 0.40); // 40% of basic
    const medicalExpenses = Math.round(basicSalary * 0.05); // 5% of basic
    const travel = Math.round(basicSalary * 0.10); // 10% of basic
    const internetCharges = 1500; // Fixed amount
    const nightShiftAllowance = 0; // Optional, set to 0
    const commission = 0; // Optional, set to 0

    // Step 3: Calculate fixed deductions
    const providentFund = Math.round(basicSalary * 0.12); // 12% of basic (PF)
    const employeeStateInsurance = basicSalary >= 21000 ? 0 : Math.round(basicSalary * 0.0075); // ESI if salary < 21000
    const professionalTax = 200; // Fixed amount for Noida
    const incomeTax = 0; // Will be calculated based on actual tax slab

    // Step 4: Calculate gross earnings (fixed components)
    const fixedEarnings = basicSalary + hra + medicalExpenses + travel + internetCharges;
    
    // Step 5: Calculate total fixed deductions
    const totalFixedDeductions = providentFund + employeeStateInsurance + professionalTax + incomeTax;

    // Step 6: Calculate the gap between CTC and fixed earnings
    // Gap = CTC - Fixed Earnings (this is what's left for Bonus + Incentives)
    const gap = ctc - fixedEarnings;

    // Step 7: Divide gap into Bonus (70%) and Incentive (30%)
    const bonus = Math.round(gap * 0.70);
    const incentives = Math.round(gap * 0.30);

    // Verify: CTC = Gross Earnings, Net Salary = CTC - Deductions
    const grossEarningsTotal = fixedEarnings + bonus + incentives;
    const netSalaryCheck = grossEarningsTotal - totalFixedDeductions;

    console.log('💰 [AUTO-CALC] CTC (Gross Earnings):', ctc);
    console.log('💰 [AUTO-CALC] Fixed Earnings:', fixedEarnings);
    console.log('💰 [AUTO-CALC] Gap for Bonus/Incentive:', gap);
    console.log('💰 [AUTO-CALC] Bonus (70%):', bonus);
    console.log('💰 [AUTO-CALC] Incentives (30%):', incentives);
    console.log('💰 [AUTO-CALC] Total Gross Earnings:', grossEarningsTotal);
    console.log('💰 [AUTO-CALC] Total Deductions:', totalFixedDeductions);
    console.log('💰 [AUTO-CALC] Net Salary:', netSalaryCheck);
    console.log('💰 [AUTO-CALC] Verification - CTC = Gross?', grossEarningsTotal === ctc);
    console.log('💰 [AUTO-CALC] Verification - Net = CTC - Deductions?', netSalaryCheck === (ctc - totalFixedDeductions));

    setEarnings({
      ...earnings,
      basic: basicSalary,
      hra,
      medicalExpenses,
      travel,
      internetCharges,
      nightShiftAllowance,
      incentives,
      bonus,
      commission
    });

    setDeductions({
      ...deductions,
      providentFund,
      employeeStateInsurance,
      professionalTax,
      incomeTax
    });

    toast.success('Salary parameters calculated! CTC = Gross Earnings, Net Salary = CTC - Deductions');
  };

  // Fetch salary structures
  const fetchStructures = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        status: 'all'
      });
      const oid = user?.orgId || user?.tenantId;
      if (user?.role === 'super_admin') {
        if (!oid || oid === 'system') {
          toast.error('Organization context is required to load salary structures.');
          setStructures([]);
          return;
        }
        params.set('orgId', oid);
      }
      const data = await apiGet<{ data?: unknown }>(`salary/structures?${params.toString()}`, false);
      setStructures(ensureArray<SalaryStructure>(data?.data));
    } catch (error) {
      console.error('Error fetching structures:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load salary structures'
      );
      setStructures([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch salary slips
  const fetchSalarySlips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500', page: '1' });
      const oid = resolveAuthOrgId(user);
      if (user?.role === 'super_admin') {
        if (!oid) {
          toast.error('Organization context is required to load salary slips.');
          setSalarySlips([]);
          return;
        }
        params.set('orgId', oid);
      }
      const data = await apiGet<{ data?: unknown }>(`/salary/slips/all?${params.toString()}`, false);
      setSalarySlips(ensureArray<SalarySlip>(data?.data));
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load salary slips'
      );
      setSalarySlips([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      await ensureAccessToken();
      const data = await apiGet<{ data?: unknown }>(
        appendOrgIdParam('/employees?simple=true&limit=1000', user),
        false
      );
      const list = ensureArray<PayrollEmployeeOption>(data?.data)
        .map((emp) => ({ ...emp, _id: payrollEmployeeId(emp) }))
        .filter((emp) => emp._id);
      setEmployees(list);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load employees for payroll'
      );
      setEmployees([]);
    }
  };

  useEffect(() => {
    if (activeTab === 'structure') {
      fetchStructures();
    } else {
      fetchSalarySlips();
    }
    fetchEmployees();
  }, [activeTab, user?.orgId, user?.tenantId, user?.role]);

  // Fetch employees when dialog opens
  useEffect(() => {
    if (showStructureDialog || showGenerateSlipDialog) {
      fetchEmployees();
      if (showStructureDialog && !editingStructureId) {
        resetForm();
      }
    }
  }, [showStructureDialog, showGenerateSlipDialog, editingStructureId]);

  // Handle create/edit salary structure
  const handleCreateStructure = async () => {
    if (!selectedEmployee || !effectiveFrom) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate that at least basic salary is set
    if (earnings.basic <= 0) {
      toast.error('Please enter a basic salary or use Auto Calculate');
      return;
    }

    try {
      setSubmitting(true);

      const endpoint = editingStructureId 
        ? `/salary/structure/${editingStructureId}`
        : '/salary/structure';
      
      const payload = {
        employeeId: selectedEmployee,
        employeeType,
        effectiveFrom,
        earnings,
        deductions
      };

      console.log('📤 [SALARY] Sending payload:', payload);
      console.log('📤 [SALARY] Earnings:', earnings);
      console.log('📤 [SALARY] Deductions:', deductions);
      
      const data = await (editingStructureId ? apiPut(endpoint, payload) : apiPost(endpoint, payload));

      console.log('📥 [SALARY] Response data:', data);

      if (data.success) {
        toast.success(editingStructureId ? 'Salary structure updated successfully' : 'Salary structure created successfully');
        setShowStructureDialog(false);
        setEditingStructureId(null);
        resetForm();
        fetchStructures();
      } else {
        console.error('❌ [SALARY] Error response:', data);
        toast.error((data as { message?: string }).message || 'Failed to create salary structure');
      }
    } catch (error) {
      console.error('❌ [SALARY] Error creating structure:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(
        msg.toLowerCase().includes('invalid credentials')
          ? 'Your session expired. Please sign in again, then create the salary structure.'
          : `Failed to create salary structure: ${msg}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete structure
  const handleDeleteStructure = async (structureId: string) => {
    if (!window.confirm('Are you sure you want to delete this salary structure?')) {
      return;
    }

    try {
      console.log('🗑️ [SALARY] Deleting structure:', structureId);
      
      await apiDelete(`/salary/structure/${structureId}`);

      toast.success('Salary structure deleted successfully');
      fetchStructures();
    } catch (error) {
      console.error('❌ [SALARY] Error deleting structure:', error);
      toast.error('Failed to delete salary structure: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Handle delete salary slip (removes from employee view — same SalarySlip record)
  const handleDeleteSalarySlip = async (slipId: string) => {
    if (!window.confirm('Delete this salary slip? It will be removed for the employee as well.')) {
      return;
    }

    try {
      await apiDelete(`/salary/slip/${slipId}`);
      toast.success('Salary slip deleted');
      if (viewingSlip?._id === slipId) {
        setShowViewSlipDialog(false);
        setViewingSlip(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }
      fetchSalarySlips();
    } catch (error) {
      console.error('Error deleting salary slip:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete salary slip';
      toast.error('Failed to delete salary slip: ' + message);
    }
  };

  // Handle approve structure
  const handleApproveStructure = async (structureId: string) => {
    try {
      // FIX #6: Add proper error handling for structure approval
      if (!structureId) {
        toast.error('Invalid structure ID');
        return;
      }
      await apiPut(`/salary/structure/${structureId}/approve`, {});
      toast.success('Salary structure approved');
      await fetchStructures();
    } catch (error) {
      console.error('Error approving structure:', error);
      const message = error instanceof Error ? error.message : 'Failed to approve salary structure';
      toast.error(message);
    }
  };

  const handleRejectStructure = async (structureId: string) => {
    try {
      // FIX #6: Add proper error handling for structure rejection
      if (!structureId) {
        toast.error('Invalid structure ID');
        return;
      }
      await apiPut(`/salary/structure/${structureId}/reject`, {});
      toast.success('Salary structure rejected');
      await fetchStructures();
    } catch (error) {
      console.error('Error rejecting structure:', error);
      const message = error instanceof Error ? error.message : 'Failed to reject salary structure';
      toast.error(message);
    }
  };

  // Handle edit structure
  const handleEditStructure = async (structure: SalaryStructure) => {
    try {
      setEditingStructureId(structure._id);
      const data = await apiGet(`/salary/structures/by-id/${structure._id}`, false);
      const fullStructure = data?.data ?? data;
      if (!fullStructure || !fullStructure._id) {
        setEditingStructureId(null);
        toast.error('Failed to load salary structure details');
        return;
      }

      // Handle employeeId which could be object or string
      const empId = typeof fullStructure.employeeId === 'object' && fullStructure.employeeId?._id
        ? fullStructure.employeeId._id
        : (fullStructure.employeeId || '');
      
      setSelectedEmployee(String(empId));
      setEmployeeType(fullStructure.employeeType || 'employee');
      const eff = fullStructure.effectiveFrom
        ? new Date(fullStructure.effectiveFrom).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      setEffectiveFrom(eff);

      const earn = fullStructure.earnings || {};
      setEarnings({
        basic: earn.basic ?? 0,
        hra: earn.hra ?? 0,
        medicalExpenses: earn.medicalExpenses ?? 0,
        travel: earn.travel ?? 0,
        internetCharges: earn.internetCharges ?? 0,
        nightShiftAllowance: earn.nightShiftAllowance ?? 0,
        incentives: earn.incentives ?? 0,
        bonus: earn.bonus ?? 0,
        commission: earn.commission ?? 0,
        otherEarnings: Array.isArray(earn.otherEarnings) ? earn.otherEarnings : [],
      });

      const ded = fullStructure.deductions || {};
      setDeductions({
        providentFund: ded.providentFund ?? 0,
        employeeStateInsurance: ded.employeeStateInsurance ?? 0,
        professionalTax: ded.professionalTax ?? 0,
        incomeTax: ded.incomeTax ?? 0,
        leaveDeduction: ded.leaveDeduction ?? 0,
        otherDeductions: Array.isArray(ded.otherDeductions) ? ded.otherDeductions : [],
      });

      setCtc(0);
      setAutoCalculateEnabled(false);
      setShowStructureDialog(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      toast.error(
        'Failed to open salary structure: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
      setEditingStructureId(null);
    }
  };

  // Handle generate salary slip
  const handleGenerateSalarySlip = async () => {
    if (!slipEmployeeId || !slipMonth || !slipYear) {
      toast.error('Please select employee, month, and year');
      return;
    }

    try {
      setSlipGenerating(true);
      setSlipGenerateError(null);
      
      const data = await apiPost<any>('/salary/slip/generate', {
        employeeId: slipEmployeeId,
        month: parseInt(slipMonth.toString()),
        year: parseInt(slipYear.toString())
      });

      if (data.success) {
        toast.success('Salary slip generated successfully');
        setShowGenerateSlipDialog(false);
        setSlipEmployeeId('');
        setSlipMonth(new Date().getMonth() + 1);
        setSlipYear(new Date().getFullYear());
        setSlipGenerateError(null);
        fetchSalarySlips();
      } else {
        // Check if it's a "no approved salary structure" error
        if ((data as any).code === 'NO_APPROVED_SALARY_STRUCTURE') {
          setSlipGenerateError({
            code: 'NO_APPROVED_SALARY_STRUCTURE',
            message: data.message || 'No approved salary structure found for this employee',
            employeeName: (data as any).employeeName
          });
          toast.error('No approved salary structure found. Please create and approve one first.');
        } else {
          toast.error((data as { message?: string }).message || 'Failed to generate salary slip');
        }
      }
    } catch (error) {
      console.error('Error generating salary slip:', error);
      const msg = error instanceof Error ? error.message : 'Failed to generate salary slip';
      toast.error(
        msg.toLowerCase().includes('invalid credentials')
          ? 'Your session expired. Please sign in again, then generate the slip.'
          : msg
      );
    } finally {
      setSlipGenerating(false);
    }
  };

  // Handle generate bulk salary slips
  const handleGenerateBulkSalarySlips = async () => {
    if (!bulkMonth || !bulkYear) {
      toast.error('Please select month and year');
      return;
    }

    if (!bulkAllEmployees && bulkSelectedEmployees.length === 0) {
      toast.error('Please select employees or choose "All eligible employees"');
      return;
    }

    try {
      setBulkGenerating(true);
      const data = await apiPost('/salary/slip/generate-bulk', {
        month: parseInt(bulkMonth.toString()),
        year: parseInt(bulkYear.toString()),
        employeeIds: bulkAllEmployees ? undefined : bulkSelectedEmployees,
        allEmployees: bulkAllEmployees,
        skipExisting: bulkSkipExisting
      });

      if (data.success) {
        const result = data.data;
        setBulkResult(result);
        setShowBulkResult(true);
        toast.success(`Generated ${result.generated}, Skipped ${result.skipped}, Failed ${result.failed}`);
        setShowBulkGenerateDialog(false);
        fetchSalarySlips();
        
        // Reset bulk form
        setBulkMonth(new Date().getMonth() + 1);
        setBulkYear(new Date().getFullYear());
        setBulkAllEmployees(true);
        setBulkSelectedEmployees([]);
        setBulkSkipExisting(true);
      } else {
        toast.error((data as { message?: string }).message || 'Failed to generate bulk salary slips');
      }
    } catch (error) {
      console.error('Error generating bulk salary slips:', error);
      const msg = error instanceof Error ? error.message : 'Failed to generate bulk salary slips';
      toast.error(
        msg.toLowerCase().includes('invalid credentials')
          ? 'Your session expired. Please sign in again, then generate slips.'
          : msg
      );
    } finally {
      setBulkGenerating(false);
    }
  };

  // Handle approve salary slip
  const handleApproveSalarySlip = async (slipId: string) => {
    try {
      // FIX #6: Add proper error handling for salary slip approval
      if (!slipId) {
        toast.error('Invalid salary slip ID');
        return;
      }
      await apiPut(`/salary/slip/${slipId}/approve`, {});
      toast.success('Salary slip approved');
      await fetchSalarySlips();
    } catch (error) {
      console.error('Error approving salary slip:', error);
      const message = error instanceof Error ? error.message : 'Failed to approve salary slip';
      toast.error(message);
    }
  };

  const downloadSlipFile = async (slipId: string, month: number, year: number) => {
    const blob = await fetchSalarySlipBlob(slipId);
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `salary-slip-${year}-${String(month).padStart(2, '0')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadSalarySlip = async (slipId: string, month?: number, year?: number) => {
    try {
      const slip = salarySlips.find((s) => s._id === slipId) || viewingSlip;
      await downloadSlipFile(slipId, month ?? slip?.month ?? 0, year ?? slip?.year ?? 0);
      toast.success('Salary slip downloaded');
    } catch (error) {
      console.error('Error downloading salary slip:', error);
      toast.error('Failed to download salary slip: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleOpenSalarySlip = async (slipId: string) => {
    try {
      const blob = await fetchSalarySlipBlob(slipId);
      const objectUrl = window.URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      console.error('Error opening salary slip:', error);
      toast.error('Failed to open salary slip: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleViewSalarySlip = async (slip: SalarySlip) => {
    try {
      setViewSlipLoading(true);
      setShowViewSlipDialog(true);
      const res = await apiGet(`/salary/slip/by-id/${slip._id}`, false);
      const full = (res?.data ?? res) as SalarySlip;
      setViewingSlip(full?._id ? full : slip);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      try {
        const blob = await fetchSalarySlipBlob(slip._id);
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (blobError) {
        console.error('Error loading salary slip blob:', blobError);
        toast.error('Failed to load salary slip preview: ' + (blobError instanceof Error ? blobError.message : 'Unknown error'));
      }
    } catch (error) {
      console.error('Error loading salary slip:', error);
      setViewingSlip(slip);
      toast.error('Failed to open salary slip: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setViewSlipLoading(false);
    }
  };

  const closeViewSlipDialog = () => {
    setShowViewSlipDialog(false);
    setViewingSlip(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedEmployee('');
    setEmployeeType('employee');
    setEffectiveFrom('');
    setCtc(0);
    setAutoCalculateEnabled(false);
    setEarnings({
      basic: 0,
      hra: 0,
      medicalExpenses: 0,
      travel: 0,
      internetCharges: 0,
      nightShiftAllowance: 0,
      incentives: 0,
      bonus: 0,
      commission: 0,
      otherEarnings: []
    });
    setDeductions({
      providentFund: 0,
      employeeStateInsurance: 0,
      professionalTax: 0,
      incomeTax: 0,
      otherDeductions: []
    });
  };

  // Add other earning field
  const addOtherEarning = () => {
    setEarnings({
      ...earnings,
      otherEarnings: [
        ...(Array.isArray(earnings.otherEarnings) ? earnings.otherEarnings : []),
        { name: '', amount: 0, description: '' },
      ],
    });
  };

  // Add other deduction field
  const addOtherDeduction = () => {
    setDeductions({
      ...deductions,
      otherDeductions: [
        ...(Array.isArray(deductions.otherDeductions) ? deductions.otherDeductions : []),
        { name: '', amount: 0, description: '' },
      ],
    });
  };

  const sumSalarySection = (section: typeof earnings | typeof deductions): number =>
    (Object.values(section) as (number | SalaryField[])[]).reduce<number>((sum, val) => {
      if (typeof val === 'number') return sum + val;
      if (Array.isArray(val)) return sum + val.reduce((s, item) => s + (item.amount || 0), 0);
      return sum;
    }, 0);

  const grossEarnings = sumSalarySection(earnings);
  const totalDeductions = sumSalarySection(deductions);

  const netSalary = grossEarnings - totalDeductions;

  return (
    <div className="p-6 space-y-6">
      <OrgRequiredNotice user={user} />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-muted-foreground">Manage salary structures and generate salary slips</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/admin/payroll-runs">Payroll runs & FNF</Link>
          </Button>
          <Button
            onClick={() => {
              setEditingStructureId(null);
              setShowStructureDialog(true);
            }}
            className="rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Salary Structure
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('structure')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'structure'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Salary Structures
        </button>
        <button
          onClick={() => setActiveTab('slips')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'slips'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Salary Slips
        </button>
      </div>

      {/* Salary Structures Tab */}
      {activeTab === 'structure' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : structures.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No salary structures found</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {structures.map((structure) => (
                <Card key={structure._id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{structure.employeeName || 'Unknown Employee'}</h3>
                      <p className="text-sm text-muted-foreground">{structure.employeeType || 'Unknown Type'}</p>
                    </div>
                    <Badge variant={structure.status === 'approved' ? 'default' : 'secondary'}>
                      {structure.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Earnings</p>
                      <p className="text-lg font-semibold">₹{safeFormatInr(structure.grossEarnings)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deductions</p>
                      <p className="text-lg font-semibold">₹{safeFormatInr((structure.grossEarnings ?? 0) - (structure.netSalary ?? 0))}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Salary</p>
                      <p className="text-lg font-semibold">₹{safeFormatInr(structure.netSalary)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {structure.status === 'pending_approval' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveStructure(structure._id)}
                          className="rounded-lg"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => void handleRejectStructure(structure._id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditStructure(structure)}
                      className="rounded-lg"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteStructure(structure._id)}
                      className="rounded-lg text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Salary Slips Tab */}
      {activeTab === 'slips' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowBulkGenerateDialog(true)} variant="outline" className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Generate Bulk Payslips
            </Button>
            <Button onClick={() => setShowGenerateSlipDialog(true)} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Generate Salary Slip
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : salarySlips.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No salary slips found</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {salarySlips.map((slip) => (
                <Card key={slip._id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{slip.employeeName || 'Unknown Employee'}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(slip.year, slip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <Badge variant={slip.status === 'approved' ? 'default' : 'secondary'}>
                      {slip.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Gross Earnings</p>
                      <p className="text-lg font-semibold">₹{safeFormatInr(slip.grossEarnings)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deductions</p>
                      <p className="text-lg font-semibold">₹{safeFormatInr((slip.grossEarnings ?? 0) - (slip.netSalary ?? 0))}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Salary</p>
                      <p className="text-lg font-semibold">₹{safeFormatInr(slip.netSalary)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(slip.status === 'draft' || slip.status === 'pending_approval') && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveSalarySlip(slip._id)}
                        className="rounded-lg"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {slip.status === 'pending_approval' ? 'Approve upload' : 'Approve'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleViewSalarySlip(slip)}
                      className="rounded-lg"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSalarySlip(slip._id)}
                      className="rounded-lg"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadSalarySlip(slip._id, slip.month, slip.year)}
                      className="rounded-lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSalarySlip(slip._id)}
                      className="rounded-lg text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Salary Slip Dialog */}
      <Dialog open={showGenerateSlipDialog} onOpenChange={(open) => {
        setShowGenerateSlipDialog(open);
        if (!open) setSlipGenerateError(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Salary Slip</DialogTitle>
            <DialogDescription>
              Generate a salary slip for a month. The employee must have an approved salary structure
              (create one under Salary Structure, then approve it).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Error message with CTA */}
            {slipGenerateError?.code === 'NO_APPROVED_SALARY_STRUCTURE' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-amber-900">
                  ⚠️ No approved salary structure found for {slipGenerateError.employeeName || 'this employee'}
                </p>
                <p className="text-xs text-amber-800">
                  {slipGenerateError.message}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-lg bg-white hover:bg-amber-50"
                  onClick={() => {
                    setShowGenerateSlipDialog(false);
                    setSlipGenerateError(null);
                    setActiveTab('structure');
                    setShowStructureDialog(true);
                    setSelectedEmployee(slipEmployeeId);
                    resetForm();
                  }}
                >
                  Create Salary Structure
                </Button>
              </div>
            )}

            <div>
              <Label>Employee</Label>
              <Popover open={openSlipEmployeePopover} onOpenChange={setOpenSlipEmployeePopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSlipEmployeePopover}
                    className="w-full justify-between rounded-lg mt-2"
                  >
                    {slipEmployeeId
                      ? (() => {
                          const emp = employees.find((e) => e._id === slipEmployeeId);
                          return emp ? payrollEmployeeLabel(emp) : 'Select employee...';
                        })()
                      : 'Select employee...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search employee..." />
                    <CommandEmpty>No employees match your search.</CommandEmpty>
                    <CommandGroup>
                      {employees.map((emp) => {
                        const empName = payrollEmployeeLabel(emp);
                        const searchValue = `${empName} ${emp.employeeCode || ''}`.trim();
                        return (
                          <CommandItem
                            key={emp._id}
                            value={searchValue}
                            onSelect={() => {
                              setSlipEmployeeId(emp._id);
                              setOpenSlipEmployeePopover(false);
                              setSlipGenerateError(null);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                slipEmployeeId === emp._id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {empName}
                            {emp.employeeCode ? (
                              <span className="ml-2 text-xs text-muted-foreground">{emp.employeeCode}</span>
                            ) : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month</Label>
                <Select value={slipMonth.toString()} onValueChange={(val) => setSlipMonth(parseInt(val))}>
                  <SelectTrigger className="rounded-lg mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {new Date(2024, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Year</Label>
                <Select value={slipYear.toString()} onValueChange={(val) => setSlipYear(parseInt(val))}>
                  <SelectTrigger className="rounded-lg mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowGenerateSlipDialog(false);
                  setSlipGenerateError(null);
                }}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateSalarySlip}
                disabled={slipGenerating}
                className="rounded-lg"
              >
                {slipGenerating ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Bulk Salary Slips Dialog */}
      <Dialog open={showBulkGenerateDialog} onOpenChange={setShowBulkGenerateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Bulk Payslips</DialogTitle>
            <DialogDescription>
              Generate salary slips for multiple employees at once. Existing slips will be skipped if the option is enabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Month and Year */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month</Label>
                <Select value={bulkMonth.toString()} onValueChange={(val) => setBulkMonth(parseInt(val))}>
                  <SelectTrigger className="rounded-lg mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {new Date(2024, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Year</Label>
                <Select value={bulkYear.toString()} onValueChange={(val) => setBulkYear(parseInt(val))}>
                  <SelectTrigger className="rounded-lg mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Employee Selection */}
            <div>
              <Label className="block mb-3">Employees</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="all-employees"
                    checked={bulkAllEmployees}
                    onChange={() => setBulkAllEmployees(true)}
                    className="rounded"
                  />
                  <Label htmlFor="all-employees" className="font-normal cursor-pointer">
                    Generate for all eligible employees (active, with approved salary structure)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="selected-employees"
                    checked={!bulkAllEmployees}
                    onChange={() => setBulkAllEmployees(false)}
                    className="rounded"
                  />
                  <Label htmlFor="selected-employees" className="font-normal cursor-pointer">
                    Select specific employees
                  </Label>
                </div>

                {!bulkAllEmployees && (
                  <div className="ml-6 max-h-48 border rounded-lg p-3 overflow-y-auto bg-muted/30">
                    {employees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No employees available</p>
                    ) : (
                      <div className="space-y-2">
                        {employees.map((emp) => (
                          <div key={emp._id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`emp-${emp._id}`}
                              checked={bulkSelectedEmployees.includes(emp._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBulkSelectedEmployees([...bulkSelectedEmployees, emp._id]);
                                } else {
                                  setBulkSelectedEmployees(bulkSelectedEmployees.filter(id => id !== emp._id));
                                }
                              }}
                              className="rounded"
                            />
                            <Label htmlFor={`emp-${emp._id}`} className="font-normal cursor-pointer text-sm">
                              {payrollEmployeeLabel(emp)}
                              {emp.employeeCode && <span className="text-xs text-muted-foreground ml-2">({emp.employeeCode})</span>}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Skip Existing Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="skip-existing"
                checked={bulkSkipExisting}
                onChange={(e) => setBulkSkipExisting(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="skip-existing" className="font-normal cursor-pointer">
                Skip existing slips for this month/year (prevent duplicates)
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBulkGenerateDialog(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateBulkSalarySlips}
                disabled={bulkGenerating}
                className="rounded-lg"
              >
                {bulkGenerating ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Bulk'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Generation Results Dialog */}
      <Dialog open={showBulkResult} onOpenChange={setShowBulkResult}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Generation Summary</DialogTitle>
          </DialogHeader>

          {bulkResult && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-2">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Processed</p>
                  <p className="text-2xl font-bold">{bulkResult.processed}</p>
                </Card>
                <Card className="p-4 border-green-200 bg-green-50">
                  <p className="text-sm text-green-700">Generated</p>
                  <p className="text-2xl font-bold text-green-700">{bulkResult.generated}</p>
                </Card>
                <Card className="p-4 border-yellow-200 bg-yellow-50">
                  <p className="text-sm text-yellow-700">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-700">{bulkResult.skipped}</p>
                </Card>
                <Card className="p-4 border-red-200 bg-red-50">
                  <p className="text-sm text-red-700">Failed</p>
                  <p className="text-2xl font-bold text-red-700">{bulkResult.failed}</p>
                </Card>
              </div>

              {/* Results Table */}
              <div>
                <h3 className="font-semibold mb-3">Detailed Results</h3>
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-semibold">Employee</th>
                        <th className="p-2 text-left font-semibold">Status</th>
                        <th className="p-2 text-left font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.results?.map((result: any, idx: number) => (
                        <tr key={idx} className="border-t hover:bg-muted/50">
                          <td className="p-2">
                            <div>
                              <p className="font-medium">{result.employeeName}</p>
                              <p className="text-xs text-muted-foreground">{result.employeeId}</p>
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={
                                result.status === 'generated' ? 'default' :
                                result.status === 'skipped' ? 'secondary' :
                                'destructive'
                              }
                            >
                              {result.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-muted-foreground text-xs">
                            {result.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowBulkResult(false)}
                  className="rounded-lg"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Salary Structure Dialog */}
      <Dialog open={showStructureDialog} onOpenChange={(open) => {
        setShowStructureDialog(open);
        if (!open) {
          setEditingStructureId(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-visible">
          <DialogHeader>
            <DialogTitle>{editingStructureId ? 'Edit Salary Structure' : 'Create Salary Structure'}</DialogTitle>
            <DialogDescription>
              {editingStructureId ? 'Update salary components for an employee' : 'Define salary components for an employee'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Popover open={openStructureEmployeePopover} onOpenChange={setOpenStructureEmployeePopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openStructureEmployeePopover}
                      className="w-full justify-between rounded-lg mt-2"
                    >
                      {selectedEmployee
                        ? (() => {
                            const emp = employees.find((e) => e._id === selectedEmployee);
                            return emp ? payrollEmployeeLabel(emp) : 'Select employee...';
                          })()
                        : 'Select employee...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search employee..." />
                      <CommandEmpty>No employees match your search.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => {
                          const empName = payrollEmployeeLabel(emp);
                          const searchValue = `${empName} ${emp.employeeCode || ''}`.trim();
                          return (
                            <CommandItem
                              key={emp._id}
                              value={searchValue}
                              onSelect={() => {
                                setSelectedEmployee(emp._id);
                                setOpenStructureEmployeePopover(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedEmployee === emp._id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {empName}
                              {emp.employeeCode ? (
                                <span className="ml-2 text-xs text-muted-foreground">{emp.employeeCode}</span>
                              ) : null}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Employee Type</Label>
                  <Select value={employeeType} onValueChange={setEmployeeType}>
                    <SelectTrigger className="rounded-lg mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intern">Intern</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Effective From</Label>
                  <Input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="rounded-lg mt-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CTC (Cost to Company)</Label>
                  <Input
                    type="number"
                    value={ctc || ''}
                    onChange={(e) => handleCtcChange(parseFloat(e.target.value) || 0)}
                    className="rounded-lg mt-2"
                    placeholder="Enter CTC"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Basic salary will be auto-calculated as 45% of CTC</p>
                </div>

                <div>
                  <Label>Basic Salary</Label>
                  <Input
                    type="number"
                    value={earnings.basic || ''}
                    onChange={(e) => setEarnings({ ...earnings, basic: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                    placeholder="Enter basic salary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Or enter directly</p>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Earnings</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAutoCalculate}
                  className="rounded-lg"
                >
                  Auto Calculate
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>HRA</Label>
                  <Input
                    type="number"
                    value={earnings.hra || ''}
                    onChange={(e) => setEarnings({ ...earnings, hra: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Medical Expenses</Label>
                  <Input
                    type="number"
                    value={earnings.medicalExpenses}
                    onChange={(e) => setEarnings({ ...earnings, medicalExpenses: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Travel Allowance</Label>
                  <Input
                    type="number"
                    value={earnings.travel}
                    onChange={(e) => setEarnings({ ...earnings, travel: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Internet Charges</Label>
                  <Input
                    type="number"
                    value={earnings.internetCharges}
                    onChange={(e) => setEarnings({ ...earnings, internetCharges: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Night Shift Allowance</Label>
                  <Input
                    type="number"
                    value={earnings.nightShiftAllowance}
                    onChange={(e) => setEarnings({ ...earnings, nightShiftAllowance: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Incentives</Label>
                  <Input
                    type="number"
                    value={earnings.incentives}
                    onChange={(e) => setEarnings({ ...earnings, incentives: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Bonus</Label>
                  <Input
                    type="number"
                    value={earnings.bonus}
                    onChange={(e) => setEarnings({ ...earnings, bonus: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
                <div>
                  <Label>Commission</Label>
                  <Input
                    type="number"
                    value={earnings.commission}
                    onChange={(e) => setEarnings({ ...earnings, commission: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addOtherEarning}
                className="rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Other Earning
              </Button>
            </div>

            {/* Deductions */}
            <div className="space-y-4">
              <h3 className="font-semibold">Deductions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Provident Fund (PF)</Label>
                  <Input
                    type="number"
                    value={deductions.providentFund || ''}
                    onChange={(e) => setDeductions({ ...deductions, providentFund: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Employee State Insurance (ESI)</Label>
                  <Input
                    type="number"
                    value={deductions.employeeStateInsurance || ''}
                    onChange={(e) => setDeductions({ ...deductions, employeeStateInsurance: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Professional Tax</Label>
                  <Input
                    type="number"
                    value={deductions.professionalTax || ''}
                    onChange={(e) => setDeductions({ ...deductions, professionalTax: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Income Tax</Label>
                  <Input
                    type="number"
                    value={deductions.incomeTax || ''}
                    onChange={(e) => setDeductions({ ...deductions, incomeTax: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg mt-2"
                    placeholder="0"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addOtherDeduction}
                className="rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Other Deduction
              </Button>
            </div>

            {/* Summary */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Gross Earnings:</span>
                <span className="font-semibold">₹{safeFormatInr(grossEarnings)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Deductions:</span>
                <span className="font-semibold">₹{safeFormatInr(totalDeductions)}</span>
              </div>
              <div className="flex justify-between text-lg border-t border-border pt-2">
                <span>Net Salary:</span>
                <span className="font-bold">₹{safeFormatInr(netSalary)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStructureDialog(false);
                  setEditingStructureId(null);
                }}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateStructure}
                disabled={submitting}
                className="rounded-lg"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    {editingStructureId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingStructureId ? 'Update Structure' : 'Create Structure'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Salary Slip Dialog */}
      <Dialog open={showViewSlipDialog} onOpenChange={(open) => !open && closeViewSlipDialog()}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Salary payslip preview</DialogTitle>
            <DialogDescription>
              {viewingSlip && `${viewingSlip.employeeName || 'Employee'} - ${new Date(viewingSlip.year, viewingSlip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            </DialogDescription>
          </DialogHeader>

          {viewSlipLoading ? (
            <div className="flex justify-center items-center min-h-[480px]">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : viewingSlip ? (
            <>
              <div className="px-6 pb-2 flex flex-wrap items-center gap-3 text-sm shrink-0">
                <Badge variant={viewingSlip.status === 'approved' ? 'default' : 'secondary'}>
                  {viewingSlip.status || 'pending'}
                </Badge>
                <span className="text-muted-foreground">
                  Net: <span className="font-semibold text-foreground">₹{safeFormatInr(viewingSlip.netSalary ?? 0)}</span>
                </span>
              </div>
              <div className="flex-1 overflow-auto px-4 py-2 min-h-0">
                {previewUrl ? (
                  <iframe
                    title="Salary slip preview"
                    src={previewUrl}
                    className="w-full h-[78vh] rounded-lg border border-border bg-white"
                    style={{ minWidth: '900px' }}
                  />
                ) : null}
              </div>
              <div className="flex gap-2 justify-end border-t px-6 py-4 shrink-0">
                <Button variant="outline" onClick={closeViewSlipDialog} className="rounded-lg">
                  Close
                </Button>
                <Button variant="outline" onClick={() => handleOpenSalarySlip(viewingSlip._id)} className="rounded-lg">
                  Open in new tab
                </Button>
                <Button
                  onClick={() => handleDownloadSalarySlip(viewingSlip._id, viewingSlip.month, viewingSlip.year)}
                  className="rounded-lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDeleteSalarySlip(viewingSlip._id)}
                  className="rounded-lg text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
