import { describe, expect, it } from 'vitest';
import {
  getCurrentPayrollPeriod,
  getNextPayrollPeriod,
  getPayrollPeriodLabel,
  getSalaryDueDate,
  getEmployeeAutoPayrollPeriod,
  getEmployeePayrollCycle,
  getNextEmployeePayrollCycle,
  payrollRecordMatchesCycle,
  isAdvanceEligibleForPeriod,
  isValidPayrollPeriod,
  resolveAdvancePayrollPeriod,
} from '../lib/payrollPeriods';
import { calculateEmployeePayroll } from '../lib/payrollEngine';
import type { Advance, PayrollRecord, SalaryPayment } from '../types/payroll';

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

  it('builds a custom employee salary cycle from the day after the previous payday', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary_due_day: 15 };
    const cycle = getEmployeePayrollCycle('2026-10', employee, 28, 'same_month');

    expect(cycle.periodStart).toBe('2026-09-16');
    expect(cycle.periodEnd).toBe('2026-10-15');
    expect(cycle.dueDate).toBe('2026-10-15');
    expect(cycle.cycleKind).toBe('custom_day');
    expect(cycle.usesEmployeeCustomDay).toBe(true);
  });

  it('moves a custom-payday employee to the next cycle the day after payday', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary_due_day: 2 };

    expect(
      getEmployeeAutoPayrollPeriod(employee, 28, 'same_month', new Date(2026, 9, 2, 12))
    ).toBe('2026-10');

    expect(
      getEmployeeAutoPayrollPeriod(employee, 28, 'same_month', new Date(2026, 9, 3, 12))
    ).toBe('2026-11');

    const nextCycle = getNextEmployeePayrollCycle('2026-10', employee, 28, 'same_month');
    expect(nextCycle.periodStart).toBe('2026-10-03');
    expect(nextCycle.periodEnd).toBe('2026-11-02');
  });

  it('clamps employee payday 31 safely in short months', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary_due_day: 31 };
    const february = getEmployeePayrollCycle('2026-02', employee, 28, 'same_month');

    expect(february.periodEnd).toBe('2026-02-28');
    expect(february.dueDate).toBe('2026-02-28');
  });

  it('uses the custom employee cycle range for attendance instead of calendar month', () => {
    const cycle = getEmployeePayrollCycle(
      '2026-10',
      { id: 'emp_1', name: 'محمد', salary_due_day: 15 },
      28,
      'same_month'
    );

    const payroll = calculateEmployeePayroll({
      employee: { id: 'emp_1', name: 'محمد', salary: 9000 },
      period: '2026-10',
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      salaryDueDate: cycle.dueDate,
      cycleKind: cycle.cycleKind,
      attendanceRecords: [
        { employeeId: 'emp_1', date: '2026-09-15', status: 'absent' },
        { employeeId: 'emp_1', date: '2026-09-16', status: 'present', hours: 8 },
        { employeeId: 'emp_1', date: '2026-10-15', status: 'absent' },
        { employeeId: 'emp_1', date: '2026-10-16', status: 'absent' },
      ],
      advances: [],
      payments: [],
    });

    expect(payroll.attendanceSummary.attendedDays).toBe(1);
    expect(payroll.attendanceSummary.absentDays).toBe(1);
    expect(payroll.periodStart).toBe('2026-09-16');
    expect(payroll.periodEnd).toBe('2026-10-15');
    expect(payroll.salaryDueDate).toBe('2026-10-15');
  });

  it('a salary fully offset by an advance is paid with zero cash salary remaining', () => {
    const advance = makeAdvance({
      amount: 8000,
      remainingAmount: 8000,
      installmentAmount: 8000,
      payrollPeriod: '2026-10',
      firstDeductionPeriod: '2026-10',
    });

    const payroll = calculateEmployeePayroll({
      employee: { id: 'emp_1', name: 'محمد', salary: 8000 },
      period: '2026-10',
      attendanceRecords: [],
      advances: [advance],
      payments: [],
    });

    expect(payroll.advanceDeductions).toBe(8000);
    expect(payroll.netSalary).toBe(0);
    expect(payroll.remaining).toBe(0);
    expect(payroll.status).toBe('paid');
  });

  it('does not let a paid legacy October payroll hijack a new custom October cycle', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary: 9000, salary_due_day: 15 };
    const cycle = getEmployeePayrollCycle('2026-10', employee, 28, 'same_month');

    const legacyPayroll = {
      id: 'payroll_emp_1_2026_10',
      tenant_id: 'tenant_1',
      employeeId: 'emp_1',
      employeeName: 'محمد',
      employeeRole: 'مساعد',
      period: '2026-10',
      year: 2026,
      month: 10,
      basicSalarySnapshot: 9000,
      dailyRateSnapshot: 300,
      hourlyRateSnapshot: 37.5,
      allowances: 0,
      overtime: 0,
      bonuses: 0,
      grossSalary: 9000,
      attendanceDeductions: 0,
      attendanceSummary: {
        attendedDays: 0,
        absentDays: 0,
        lateCount: 0,
        totalLateMinutes: 0,
        earlyLeaveMinutes: 0,
        totalHours: 0,
        deductionReason: 'لا توجد خصومات حضور',
      },
      manualDeductions: 0,
      advanceDeductions: 3000,
      netSalary: 6000,
      totalPaid: 6000,
      remaining: 0,
      status: 'paid',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    } satisfies PayrollRecord;

    expect(payrollRecordMatchesCycle(legacyPayroll, cycle)).toBe(false);
  });

  it('new custom cycle ignores legacy paid salary and old fully-paid advance from the same month', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary: 9000, salary_due_day: 15 };
    const cycle = getEmployeePayrollCycle('2026-10', employee, 28, 'same_month');

    const legacyAdvance = makeAdvance({
      id: 'legacy_adv',
      amount: 3000,
      paidAmount: 3000,
      remainingAmount: 0,
      installmentAmount: 3000,
      remainingInstallments: 0,
      payrollPeriod: undefined,
      firstDeductionPeriod: undefined,
      startDate: '2026-10-01',
      status: 'fully_paid',
      deductedPeriods: ['2026-10'],
      deductedCycleKeys: undefined,
    });

    const legacyPayment = {
      id: 'legacy_payment',
      tenant_id: 'tenant_1',
      payrollId: 'payroll_emp_1_2026_10',
      employeeId: 'emp_1',
      employeeName: 'محمد',
      payrollPeriod: '2026-10',
      amount: 6000,
      paymentMethod: 'cash',
      idempotencyKey: 'legacy',
      status: 'completed',
      createdAt: '2026-10-01T10:00:00.000Z',
      createdBy: 'admin',
    } satisfies SalaryPayment;

    const payroll = calculateEmployeePayroll({
      employee,
      period: '2026-10',
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      salaryDueDate: cycle.dueDate,
      cycleKind: cycle.cycleKind,
      cycleKey: cycle.cycleKey,
      attendanceRecords: [],
      advances: [legacyAdvance],
      payments: [legacyPayment],
      existingRecord: null,
    });

    expect(payroll.cycleKey).toBe(cycle.cycleKey);
    expect(payroll.advanceDeductions).toBe(0);
    expect(payroll.totalPaid).toBe(0);
    expect(payroll.netSalary).toBe(9000);
    expect(payroll.remaining).toBe(9000);
    expect(payroll.status).toBe('unpaid');
  });

  it('does not display or double-charge a legacy installment already deducted in the same month', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary: 9000, salary_due_day: 15 };
    const cycle = getEmployeePayrollCycle('2026-10', employee, 28, 'same_month');

    const legacyPartiallyPaidAdvance = makeAdvance({
      id: 'legacy_installment_advance',
      amount: 6000,
      paidAmount: 3000,
      remainingAmount: 3000,
      repaymentType: 'installments',
      installmentAmount: 3000,
      numberOfInstallments: 2,
      remainingInstallments: 1,
      payrollPeriod: undefined,
      firstDeductionPeriod: undefined,
      startDate: '2026-09-01',
      status: 'partially_paid',
      deductedPeriods: ['2026-10'],
      deductedCycleKeys: undefined,
    });

    const payroll = calculateEmployeePayroll({
      employee,
      period: '2026-10',
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      salaryDueDate: cycle.dueDate,
      cycleKind: cycle.cycleKind,
      cycleKey: cycle.cycleKey,
      attendanceRecords: [],
      advances: [legacyPartiallyPaidAdvance],
      payments: [],
    });

    expect(payroll.advanceDeductions).toBe(0);
    expect(payroll.netSalary).toBe(9000);
    expect(payroll.remaining).toBe(9000);
  });

  it('new salary payment affects only its exact custom cycle', () => {
    const employee = { id: 'emp_1', name: 'محمد', salary: 9000, salary_due_day: 15 };
    const cycle = getEmployeePayrollCycle('2026-10', employee, 28, 'same_month');

    const currentCyclePayment = {
      id: 'current_payment',
      tenant_id: 'tenant_1',
      payrollId: 'payroll_cycle_' + cycle.cycleKey,
      employeeId: 'emp_1',
      employeeName: 'محمد',
      payrollPeriod: '2026-10',
      payrollCycleKey: cycle.cycleKey,
      amount: 2000,
      paymentMethod: 'cash',
      idempotencyKey: 'current-cycle',
      status: 'completed',
      createdAt: '2026-10-03T10:00:00.000Z',
      createdBy: 'admin',
    } satisfies SalaryPayment;

    const payroll = calculateEmployeePayroll({
      employee,
      period: '2026-10',
      periodStart: cycle.periodStart,
      periodEnd: cycle.periodEnd,
      salaryDueDate: cycle.dueDate,
      cycleKind: cycle.cycleKind,
      cycleKey: cycle.cycleKey,
      attendanceRecords: [],
      advances: [],
      payments: [currentCyclePayment],
    });

    expect(payroll.totalPaid).toBe(2000);
    expect(payroll.remaining).toBe(7000);
    expect(payroll.status).toBe('partial');
  });

  it('Arabic payroll period label is non-empty', () => {
    expect(getPayrollPeriodLabel('2026-10').length).toBeGreaterThan(0);
  });
});
