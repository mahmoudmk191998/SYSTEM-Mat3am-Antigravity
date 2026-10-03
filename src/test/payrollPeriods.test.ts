import { describe, expect, it } from 'vitest';
import {
  getCurrentPayrollPeriod,
  getNextPayrollPeriod,
  getPayrollPeriodLabel,
  getSalaryDueDate,
  isAdvanceEligibleForPeriod,
  isValidPayrollPeriod,
  resolveAdvancePayrollPeriod,
} from '../lib/payrollPeriods';
import { calculateEmployeePayroll } from '../lib/payrollEngine';
import type { Advance } from '../types/payroll';

function makeAdvance(overrides: Partial<Advance> = {}): Advance {
  return {
    id: 'adv_1',
    tenant_id: 'tenant_1',
    employeeId: 'emp_1',
    employeeName: 'أحمد',
    amount: 2000,
    paidAmount: 0,
    remainingAmount: 2000,
    repaymentType: 'next_salary',
    installmentAmount: 2000,
    numberOfInstallments: 1,
    remainingInstallments: 1,
    startDate: '2026-10-03',
    payrollPeriod: '2026-10',
    firstDeductionPeriod: '2026-10',
    paymentMethod: 'cash',
    status: 'active',
    deductedPeriods: [],
    createdAt: '2026-10-03T09:00:00.000Z',
    createdBy: 'admin',
    ...overrides,
  };
}

describe('Payroll Period & Advance Month Tracking', () => {
  it('validates YYYY-MM payroll periods', () => {
    expect(isValidPayrollPeriod('2026-10')).toBe(true);
    expect(isValidPayrollPeriod('2026-13')).toBe(false);
    expect(isValidPayrollPeriod('10-2026')).toBe(false);
  });

  it('returns the expected period from a fixed date', () => {
    expect(getCurrentPayrollPeriod(new Date(2026, 9, 3))).toBe('2026-10');
  });

  it('moves to the next month including year rollover', () => {
    expect(getNextPayrollPeriod('2026-10')).toBe('2026-11');
    expect(getNextPayrollPeriod('2026-12')).toBe('2027-01');
  });

  it('calculates salary due date in same or next month and clamps invalid month days', () => {
    expect(getSalaryDueDate('2026-10', 25, 'same_month')).toBe('2026-10-25');
    expect(getSalaryDueDate('2026-12', 5, 'next_month')).toBe('2027-01-05');
    expect(getSalaryDueDate('2026-02', 31, 'same_month')).toBe('2026-02-28');
  });

  it('resolves explicit payroll month before legacy date fallback', () => {
    const advance = makeAdvance({
      payrollPeriod: '2026-11',
      firstDeductionPeriod: '2026-11',
      startDate: '2026-10-03',
    });
    expect(resolveAdvancePayrollPeriod(advance)).toBe('2026-11');
  });

  it('keeps legacy advances compatible by deriving month from startDate', () => {
    const advance = makeAdvance({
      payrollPeriod: undefined,
      firstDeductionPeriod: undefined,
      startDate: '2026-09-17',
    });
    expect(resolveAdvancePayrollPeriod(advance)).toBe('2026-09');
  });

  it('prevents a new advance from being deducted in an older payroll month', () => {
    const advance = makeAdvance();
    expect(isAdvanceEligibleForPeriod(advance, '2026-09')).toBe(false);
    expect(isAdvanceEligibleForPeriod(advance, '2026-10')).toBe(true);
    expect(isAdvanceEligibleForPeriod(advance, '2026-11')).toBe(true);
  });

  it('payroll engine excludes October advance from September and includes it in October', () => {
    const advance = makeAdvance();

    const september = calculateEmployeePayroll({
      employee: { id: 'emp_1', name: 'أحمد', salary: 8000 },
      period: '2026-09',
      attendanceRecords: [],
      advances: [advance],
      payments: [],
    });
    const october = calculateEmployeePayroll({
      employee: { id: 'emp_1', name: 'أحمد', salary: 8000 },
      period: '2026-10',
      attendanceRecords: [],
      advances: [advance],
      payments: [],
    });

    expect(september.advanceDeductions).toBe(0);
    expect(september.netSalary).toBe(8000);
    expect(october.advanceDeductions).toBe(2000);
    expect(october.netSalary).toBe(6000);
  });

  it('Arabic payroll period label is non-empty', () => {
    expect(getPayrollPeriodLabel('2026-10').length).toBeGreaterThan(0);
  });
});
