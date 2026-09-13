import type {
  PayrollRecord,
  PayrollPeriod,
  PayrollStatus,
  Advance,
  SalaryPayment,
  AttendanceSummary,
} from '@/types/payroll';

export interface EmployeeData {
  id: string;
  name: string;
  role?: string;
  department?: string;
  salary?: number | string;
  employee_type?: string;
  status?: string;
}

export interface AttendanceRecordData {
  id?: string;
  employeeId?: string;
  employee_id?: string;
  date: string; // YYYY-MM-DD
  status: string; // 'present' | 'late' | 'early_leave' | 'absent' | 'on_leave'
  lateMinutes?: number;
  hours?: number;
  workedMinutes?: number;
  checkIn?: string;
  checkOut?: string;
}

export interface PayrollCalculationOptions {
  employee: EmployeeData;
  period: PayrollPeriod; // 'YYYY-MM'
  attendanceRecords: AttendanceRecordData[];
  advances: Advance[];
  payments: SalaryPayment[];
  existingRecord?: Partial<PayrollRecord> | null;
  hrSettings?: {
    late_deduction_enabled?: boolean;
    overtime_enabled?: boolean;
  };
  manualAdditions?: {
    allowances?: number;
    bonuses?: number;
    overtime?: number;
  };
  manualDeductions?: {
    amount?: number;
    reason?: string;
  };
}

/**
 * Deterministically calculates payroll for a given employee and period.
 * Protects historical data by prioritizing basicSalarySnapshot when available.
 */
export function calculateEmployeePayroll(options: PayrollCalculationOptions): PayrollRecord {
  const {
    employee,
    period,
    attendanceRecords,
    advances,
    payments,
    existingRecord,
    hrSettings,
    manualAdditions,
    manualDeductions,
  } = options;

  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;

  // 1. Basic Salary Snapshot (Preserve historical snapshot if it already exists!)
  const baseSalary = existingRecord?.basicSalarySnapshot !== undefined
    ? Number(existingRecord.basicSalarySnapshot)
    : Math.max(0, Number(employee.salary) || 0);

  const dailyRate = baseSalary > 0 ? baseSalary / 30 : 0;
  const hourlyRate = dailyRate / 8;

  // 2. Attendance Metrics for the period
  const empAttendance = attendanceRecords.filter((a) => {
    const empId = a.employeeId || a.employee_id;
    return empId === employee.id && a.date && a.date.startsWith(period);
  });

  const attendedDays = empAttendance.filter(
    (a) => a.status === 'present' || a.status === 'late' || a.status === 'early_leave'
  ).length;

  const absentDays = empAttendance.filter((a) => a.status === 'absent').length;

  const lateCount = empAttendance.filter(
    (a) => a.status === 'late' || (Number(a.lateMinutes) || 0) > 0
  ).length;

  const totalLateMinutes = empAttendance.reduce(
    (sum, a) => sum + (Number(a.lateMinutes) || 0),
    0
  );

  const totalHours = empAttendance.reduce(
    (sum, a) => sum + (Number(a.hours) || 0),
    0
  );

  // Calculate early leave minutes if present
  const earlyLeaveMinutes = empAttendance.reduce((sum, a) => {
    if (a.status === 'early_leave' && (a as any).earlyMinutes) {
      return sum + Number((a as any).earlyMinutes);
    }
    return sum;
  }, 0);

  // 3. Attendance Deductions
  let lateDeductions = 0;
  if (hrSettings?.late_deduction_enabled && totalLateMinutes > 0) {
    lateDeductions = Math.round((totalLateMinutes / 60) * hourlyRate);
  }

  // Absence deduction (dailyRate per absent day)
  let absenceDeductions = 0;
  if (absentDays > 0) {
    absenceDeductions = Math.round(absentDays * dailyRate);
  }

  const attendanceDeductions = lateDeductions + absenceDeductions;

  // Build human-readable breakdown explanation
  const deductionParts: string[] = [];
  if (lateDeductions > 0) {
    deductionParts.push(`تأخير: ${lateDeductions} ج.م (${totalLateMinutes} دقيقة)`);
  }
  if (absenceDeductions > 0) {
    deductionParts.push(`غياب: ${absenceDeductions} ج.م (${absentDays} يوم)`);
  }
  const deductionReason = deductionParts.length > 0
    ? deductionParts.join(' | ')
    : 'لا توجد خصومات حضور';

  const attendanceSummary: AttendanceSummary = {
    attendedDays,
    absentDays,
    lateCount,
    totalLateMinutes,
    earlyLeaveMinutes,
    totalHours: Math.round(totalHours * 10) / 10,
    deductionReason,
  };

  // 4. Overtime & Allowances
  let overtime = 0;
  if (hrSettings?.overtime_enabled && totalHours > attendedDays * 8) {
    const overtimeHours = totalHours - attendedDays * 8;
    overtime = Math.round(overtimeHours * hourlyRate * 1.5);
  }
  if (manualAdditions?.overtime !== undefined) {
    overtime = Number(manualAdditions.overtime) || 0;
  } else if (existingRecord?.overtime !== undefined && existingRecord.overtime > 0) {
    overtime = Number(existingRecord.overtime);
  }

  const bonuses = manualAdditions?.bonuses !== undefined
    ? Number(manualAdditions.bonuses)
    : Number(existingRecord?.bonuses || 0);

  const allowances = manualAdditions?.allowances !== undefined
    ? Number(manualAdditions.allowances)
    : Number(existingRecord?.allowances || 0);

  const grossSalary = Math.round(baseSalary + overtime + bonuses + allowances);

  // 5. Advances Deductions (Strict idempotency checking!)
  const empAdvances = advances.filter(
    (adv) => adv.employeeId === employee.id && adv.status !== 'cancelled'
  );

  let advanceDeductions = 0;
  for (const adv of empAdvances) {
    // If the advance has already been deducted in this period:
    if (adv.deductedPeriods && adv.deductedPeriods.includes(period)) {
      // Use the installment amount that was previously locked for this period
      const lockedAmount = adv.repaymentType === 'next_salary'
        ? adv.amount
        : Math.min(adv.amount, adv.installmentAmount || adv.amount);
      advanceDeductions += lockedAmount;
    } else if (adv.remainingAmount > 0) {
      // Calculate installment for this period
      if (adv.repaymentType === 'next_salary') {
        advanceDeductions += adv.remainingAmount;
      } else {
        const inst = Math.min(adv.remainingAmount, adv.installmentAmount || adv.remainingAmount);
        advanceDeductions += inst;
      }
    }
  }

  // 6. Manual Deductions
  const manualDeductionsAmount = manualDeductions?.amount !== undefined
    ? Number(manualDeductions.amount)
    : Number(existingRecord?.manualDeductions || 0);

  const manualDeductionsReason = manualDeductions?.reason !== undefined
    ? manualDeductions.reason
    : existingRecord?.manualDeductionsReason || '';

  // 7. Net Salary
  const netSalary = Math.max(
    0,
    Math.round(grossSalary - attendanceDeductions - manualDeductionsAmount - advanceDeductions)
  );

  // 8. Total Paid from Completed Salary Payments
  const empPayments = payments.filter(
    (p) =>
      p.employeeId === employee.id &&
      p.payrollPeriod === period &&
      p.status === 'completed'
  );

  const totalPaid = empPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remaining = Math.max(0, netSalary - totalPaid);

  let status: PayrollStatus = 'unpaid';
  if (totalPaid >= netSalary && netSalary > 0) {
    status = 'paid';
  } else if (totalPaid > 0) {
    status = 'partial';
  } else if (netSalary === 0 && (grossSalary > 0 || baseSalary > 0)) {
    // If net salary was completely offset by deductions/advances
    status = 'paid';
  }

  const recordId = existingRecord?.id || `payroll_${employee.id}_${period.replace('-', '_')}`;

  return {
    id: recordId,
    tenant_id: existingRecord?.tenant_id || '',
    branch_id: existingRecord?.branch_id || '',
    employeeId: employee.id,
    employeeName: employee.name,
    employeeRole: employee.role || '',
    period,
    year,
    month,
    basicSalarySnapshot: baseSalary,
    dailyRateSnapshot: Math.round(dailyRate * 100) / 100,
    hourlyRateSnapshot: Math.round(hourlyRate * 100) / 100,
    allowances,
    overtime,
    bonuses,
    grossSalary,
    attendanceDeductions,
    attendanceSummary,
    manualDeductions: manualDeductionsAmount,
    manualDeductionsReason: manualDeductionsReason || '',
    advanceDeductions,
    netSalary,
    totalPaid,
    remaining,
    status,
    createdAt: existingRecord?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: existingRecord?.createdBy || '',
  };
}

/**
 * Calculates due installment amount for an advance for a given period.
 * Returns 0 if already deducted for this period or if fully paid/cancelled.
 */
export function calculateAdvanceDueInstallment(advance: Advance, period: PayrollPeriod): number {
  if (advance.status === 'cancelled' || advance.status === 'fully_paid') {
    return 0;
  }
  if (advance.remainingAmount <= 0) {
    return 0;
  }
  if (advance.deductedPeriods && advance.deductedPeriods.includes(period)) {
    return 0; // Already deducted for this period!
  }

  if (advance.repaymentType === 'next_salary') {
    return advance.remainingAmount;
  }

  return Math.min(advance.remainingAmount, advance.installmentAmount || advance.remainingAmount);
}

/**
 * Simulates or executes advancing deduction state transition
 */
export function applyAdvanceDeduction(advance: Advance, period: PayrollPeriod, installmentAmount: number): Advance {
  if (advance.deductedPeriods && advance.deductedPeriods.includes(period)) {
    return advance; // Idempotent
  }

  const paidAmount = (advance.paidAmount || 0) + installmentAmount;
  const remainingAmount = Math.max(0, (advance.amount || 0) - paidAmount);
  const remainingInstallments = Math.max(0, (advance.remainingInstallments || 1) - 1);

  const status = remainingAmount <= 0 ? 'fully_paid' : 'partially_paid';

  return {
    ...advance,
    paidAmount,
    remainingAmount,
    remainingInstallments,
    status,
    deductedPeriods: [...(advance.deductedPeriods || []), period],
  };
}
