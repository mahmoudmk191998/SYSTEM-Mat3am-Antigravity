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
  createdAt: string; // ISO 8601
}
