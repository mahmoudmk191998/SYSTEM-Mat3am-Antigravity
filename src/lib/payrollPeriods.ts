import type { Advance, PayrollPeriod, SalaryDueTiming } from '@/types/payroll';

const PAYROLL_PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPayrollPeriod(value: unknown): value is PayrollPeriod {
  return typeof value === 'string' && PAYROLL_PERIOD_RE.test(value);
}

export function getCurrentPayrollPeriod(date: Date = new Date()): PayrollPeriod {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return year + '-' + month;
}

export function getNextPayrollPeriod(period: PayrollPeriod): PayrollPeriod {
  if (!isValidPayrollPeriod(period)) return getCurrentPayrollPeriod();
  const [yearRaw, monthRaw] = period.split('-').map(Number);
  const next = new Date(yearRaw, monthRaw, 1);
  return getCurrentPayrollPeriod(next);
}

export function getPayrollPeriodLabel(period: PayrollPeriod, locale = 'ar-EG'): string {
  if (!isValidPayrollPeriod(period)) return 'فترة غير محددة';
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}

export function getSalaryDueDate(
  period: PayrollPeriod,
  dueDay = 28,
  timing: SalaryDueTiming = 'same_month'
): string {
  const basePeriod = isValidPayrollPeriod(period) ? period : getCurrentPayrollPeriod();
  const targetPeriod = timing === 'next_month' ? getNextPayrollPeriod(basePeriod) : basePeriod;
  const [year, month] = targetPeriod.split('-').map(Number);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(lastDayOfMonth, Math.max(1, Number(dueDay) || 28));
  return year + '-' + String(month).padStart(2, '0') + '-' + String(safeDay).padStart(2, '0');
}

type AdvancePeriodFields = Pick<
  Advance,
  'payrollPeriod' | 'firstDeductionPeriod' | 'startDate' | 'createdAt'
>;

export function resolveAdvancePayrollPeriod(advance: AdvancePeriodFields): PayrollPeriod | null {
  const candidates = [
    advance.firstDeductionPeriod,
    advance.payrollPeriod,
    advance.startDate?.slice(0, 7),
    advance.createdAt?.slice(0, 7),
  ];

  for (const candidate of candidates) {
    if (isValidPayrollPeriod(candidate)) return candidate;
  }

  return null;
}

export function getAdvancePayrollPeriodLabel(advance: AdvancePeriodFields): string {
  const period = resolveAdvancePayrollPeriod(advance);
  return period ? getPayrollPeriodLabel(period) : 'غير محدد';
}

export function isAdvanceEligibleForPeriod(
  advance: AdvancePeriodFields,
  period: PayrollPeriod
): boolean {
  if (!isValidPayrollPeriod(period)) return false;
  const firstPeriod = resolveAdvancePayrollPeriod(advance);

  // Backward compatibility: very old malformed records without a usable
  // month/date keep the previous behaviour rather than silently disappearing.
  return firstPeriod ? period >= firstPeriod : true;
}
