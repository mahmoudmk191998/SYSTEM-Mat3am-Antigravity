export type ExpenseCategory = 'رواتب' | 'مشتريات' | 'صيانة' | 'أخرى';

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  date: string; // YYYY-MM-DD
  createdBy: string; // User ID
  branchId?: string; // Tenant/Branch ID
  shift_id?: string; // Connected Shift ID
  payment_id?: string; // Reference to salary_payment ID
  reference_id?: string; // e.g. salary_payment_{paymentId}
  payroll_period?: string; // e.g. '2026-09'
  employee_id?: string; // Connected employee ID
  status?: 'active' | 'voided';
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string; // ISO 8601
}

