import type {
  Advance,
  PayrollCycleKind,
  PayrollPeriod,
  SalaryDueTiming,
} from '@/types/payroll';

const PAYROLL_PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface EmployeePayrollCycle {
  period: PayrollPeriod;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  dueDay: number;
  dueTiming: SalaryDueTiming;
  cycleKind: PayrollCycleKind;
  usesEmployeeCustomDay: boolean;
}

export function isValidPayrollPeriod(value: unknown): value is PayrollPeriod {
  return typeof value === 'string' && PAYROLL_PERIOD_RE.test(value);
}

export function getCurrentPayrollPeriod(date: Date = new Date()): PayrollPeriod {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return year + '-' + month;
}

export function getNextPayrollPeriod(period: PayrollPeriod): PayrollPeriod {
  return shiftPayrollPeriod(period, 1);
}

export function getPreviousPayrollPeriod(period: PayrollPeriod): PayrollPeriod {
  return shiftPayrollPeriod(period, -1);
}

export function shiftPayrollPeriod(period: PayrollPeriod, months: number): PayrollPeriod {
  if (!isValidPayrollPeriod(period)) return getCurrentPayrollPeriod();
  const [yearRaw, monthRaw] = period.split('-').map(Number);
  const shifted = new Date(Date.UTC(yearRaw, monthRaw - 1 + months, 1));
  return shifted.getUTCFullYear() + '-' + String(shifted.getUTCMonth() + 1).padStart(2, '0');
}

export function getPayrollPeriodLabel(period: PayrollPeriod, locale = 'ar-EG'): string {
  if (!isValidPayrollPeriod(period)) return 'فترة غير محددة';
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function normalizeDay(day: unknown, fallback = 28): number {
  const numeric = Number(day);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(31, Math.max(1, Math.trunc(numeric)));
}

function getDateForPeriodDay(period: PayrollPeriod, day: number): string {
  const safePeriod = isValidPayrollPeriod(period) ? period : getCurrentPayrollPeriod();
  const [year, month] = safePeriod.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(lastDay, normalizeDay(day));
  return year + '-' + String(month).padStart(2, '0') + '-' + String(safeDay).padStart(2, '0');
}

function getLastDateOfPeriod(period: PayrollPeriod): string {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
}

function addDays(date: string, days: number): string {
  if (!ISO_DATE_RE.test(date)) return date;
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function getSalaryDueDate(
  period: PayrollPeriod,
  dueDay = 28,
  timing: SalaryDueTiming = 'same_month'
): string {
  const basePeriod = isValidPayrollPeriod(period) ? period : getCurrentPayrollPeriod();
  const targetPeriod = timing === 'next_month' ? getNextPayrollPeriod(basePeriod) : basePeriod;
  return getDateForPeriodDay(targetPeriod, dueDay);
}

export function getEmployeeCustomSalaryDay(employee: any): number | null {
  const raw = employee?.salary_due_day ?? employee?.salaryDueDay;
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 1 || numeric > 31) return null;
  return Math.trunc(numeric);
}

export function getEmployeePayrollCycle(
  period: PayrollPeriod,
  employee: any,
  globalDueDay = 28,
  globalDueTiming: SalaryDueTiming = 'same_month'
): EmployeePayrollCycle {
  const safePeriod = isValidPayrollPeriod(period) ? period : getCurrentPayrollPeriod();
  const customDay = getEmployeeCustomSalaryDay(employee);

  if (customDay !== null) {
    const previousPeriod = getPreviousPayrollPeriod(safePeriod);
    const previousDueDate = getDateForPeriodDay(previousPeriod, customDay);
    const dueDate = getDateForPeriodDay(safePeriod, customDay);

    return {
      period: safePeriod,
      periodStart: addDays(previousDueDate, 1),
      periodEnd: dueDate,
      dueDate,
      dueDay: customDay,
      dueTiming: 'same_month',
      cycleKind: 'custom_day',
      usesEmployeeCustomDay: true,
    };
  }

  const dueDay = normalizeDay(globalDueDay);
  return {
    period: safePeriod,
    periodStart: safePeriod + '-01',
    periodEnd: getLastDateOfPeriod(safePeriod),
    dueDate: getSalaryDueDate(safePeriod, dueDay, globalDueTiming),
    dueDay,
    dueTiming: globalDueTiming,
    cycleKind: 'calendar_month',
    usesEmployeeCustomDay: false,
  };
}

export function getLatestDuePayrollPeriod(
  referenceDate: Date = new Date(),
  dueDay = 28,
  timing: SalaryDueTiming = 'same_month'
): PayrollPeriod {
  const currentPeriod = getCurrentPayrollPeriod(referenceDate);
  const today = referenceDate.getFullYear() + '-' +
    String(referenceDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(referenceDate.getDate()).padStart(2, '0');

  if (timing === 'same_month') {
    return today >= getSalaryDueDate(currentPeriod, dueDay, 'same_month')
      ? currentPeriod
      : getPreviousPayrollPeriod(currentPeriod);
  }

  const previousPeriod = getPreviousPayrollPeriod(currentPeriod);
  return today >= getSalaryDueDate(previousPeriod, dueDay, 'next_month')
    ? previousPeriod
    : getPreviousPayrollPeriod(previousPeriod);
}

export function getEmployeeAutoPayrollPeriod(
  employee: any,
  globalDueDay = 28,
  globalDueTiming: SalaryDueTiming = 'same_month',
  referenceDate: Date = new Date()
): PayrollPeriod {
  const customDay = getEmployeeCustomSalaryDay(employee);
  if (customDay === null) {
    return getLatestDuePayrollPeriod(referenceDate, globalDueDay, globalDueTiming);
  }

  const currentPeriod = getCurrentPayrollPeriod(referenceDate);
  const today = referenceDate.getFullYear() + '-' +
    String(referenceDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(referenceDate.getDate()).padStart(2, '0');
  const currentCycle = getEmployeePayrollCycle(currentPeriod, employee, globalDueDay, globalDueTiming);

  return today >= currentCycle.dueDate
    ? currentPeriod
    : getPreviousPayrollPeriod(currentPeriod);
}

export function getNextEmployeePayrollCycle(
  currentPeriod: PayrollPeriod,
  employee: any,
  globalDueDay = 28,
  globalDueTiming: SalaryDueTiming = 'same_month'
): EmployeePayrollCycle {
  return getEmployeePayrollCycle(
    getNextPayrollPeriod(currentPeriod),
    employee,
    globalDueDay,
    globalDueTiming
  );
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
  return firstPeriod ? period >= firstPeriod : true;
}
