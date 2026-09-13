import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  HandCoins,
  Receipt,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';
import type { PayrollRecord, SalaryPayment, Advance, AdvanceInstallment } from '@/types/payroll';
import { AdvanceModal } from './AdvanceModal';

interface EmployeeFinancialTabProps {
  employee: any;
  payrolls: PayrollRecord[];
  payments: SalaryPayment[];
  advances: Advance[];
  installments: AdvanceInstallment[];
  onCreateAdvance: (data: any) => Promise<string | null>;
  onCancelAdvance: (advanceId: string, reason: string) => Promise<boolean>;
}

export const EmployeeFinancialTab: React.FC<EmployeeFinancialTabProps> = ({
  employee,
  payrolls,
  payments,
  advances,
  installments,
  onCreateAdvance,
  onCancelAdvance,
}) => {
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);

  // Filter for this employee
  const empPayrolls = useMemo(
    () => payrolls.filter((p) => p.employeeId === employee.id),
    [payrolls, employee.id]
  );

  const empPayments = useMemo(
    () => payments.filter((p) => p.employeeId === employee.id),
    [payments, employee.id]
  );

  const empAdvances = useMemo(
    () => advances.filter((a) => a.employeeId === employee.id),
    [advances, employee.id]
  );

  const empInstallments = useMemo(
    () => installments.filter((i) => i.employeeId === employee.id),
    [installments, employee.id]
  );

  // Financial Summaries
  const basicSalary = Number(employee.salary) || 0;

  // Advances summary
  const totalAdvances = empAdvances.reduce((s, a) => s + (a.status !== 'cancelled' ? a.amount : 0), 0);
  const paidAdvances = empAdvances.reduce((s, a) => s + (a.status !== 'cancelled' ? a.paidAmount : 0), 0);
  const remainingAdvances = empAdvances.reduce((s, a) => s + (a.status !== 'cancelled' ? a.remainingAmount : 0), 0);
  const activeAdvances = empAdvances.filter((a) => a.status === 'active' || a.status === 'partially_paid');

  // Payrolls summary
  const totalDuePayrolls = empPayrolls.reduce((s, p) => s + p.netSalary, 0);
  const totalPaidPayrolls = empPayrolls.reduce((s, p) => s + p.totalPaid, 0);
  const totalRemainingPayrolls = empPayrolls.reduce((s, p) => s + p.remaining, 0);

  // Unified Transactions Timeline / Table
  const transactions = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      type: 'salary_payment' | 'advance' | 'advance_installment' | 'deduction' | 'bonus';
      typeName: string;
      amount: number;
      period?: string;
      notes?: string;
      user?: string;
      isCredit: boolean; // positive or negative
    }> = [];

    // 1. Salary Payments
    empPayments.forEach((p) => {
      list.push({
        id: p.id,
        date: p.createdAt.split('T')[0],
        type: 'salary_payment',
        typeName: p.status === 'voided' ? 'صرف راتب (ملغي)' : 'صرف راتب',
        amount: p.amount,
        period: p.payrollPeriod,
        notes: p.notes || (p.status === 'voided' ? p.voidReason : undefined),
        user: p.createdBy,
        isCredit: false,
      });
    });

    // 2. Advances
    empAdvances.forEach((a) => {
      list.push({
        id: a.id,
        date: a.createdAt.split('T')[0],
        type: 'advance',
        typeName: a.status === 'cancelled' ? 'سلفة (ملغاة)' : 'سلفة نقدية',
        amount: a.amount,
        notes: a.notes,
        user: a.createdBy,
        isCredit: true,
      });
    });

    // 3. Advance Installments
    empInstallments.forEach((i) => {
      list.push({
        id: i.id,
        date: i.paidAt.split('T')[0],
        type: 'advance_installment',
        typeName: 'سداد قسط سلفة',
        amount: i.amount,
        period: i.period,
        notes: `استقطاع من راتب شهر ${i.period}`,
        user: 'النظام',
        isCredit: false,
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [empPayments, empAdvances, empInstallments]);

  const handleCancelAdvanceClick = (adv: Advance) => {
    const reason = window.prompt(`سبب إلغاء سلفة الموظف بقيمة ${adv.amount} ج.م:`);
    if (reason && reason.trim()) {
      onCancelAdvance(adv.id, reason.trim());
    }
  };

  return (
    <div className="space-y-4 py-1 text-xs">
      {/* 1. Top Three Summary Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Block A: Current Salary Package */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-primary" />
              الراتب الحالي
            </span>
            <span className="font-bold font-mono text-sm text-primary">
              {basicSalary.toLocaleString('ar-EG')} ج.م
            </span>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-slate-800/80">
            <div className="flex justify-between">
              <span>الراتب الأساسي:</span>
              <span className="font-mono">{basicSalary.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>اليومية التقريبية (30 يوم):</span>
              <span className="font-mono">{(basicSalary / 30).toFixed(1)} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>ساعة العمل التقريبية (8 س):</span>
              <span className="font-mono">{(basicSalary / 240).toFixed(1)} ج.م</span>
            </div>
          </div>
        </div>

        {/* Block B: Advances Summary */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <HandCoins className="w-4 h-4 text-amber-400" />
              السلف والأقساط
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAdvanceModalOpen(true)}
              className="h-6 px-2 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1"
            >
              <Plus className="w-3 h-3" />
              سلفة
            </Button>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-slate-800/80">
            <div className="flex justify-between">
              <span>إجمالي السلف:</span>
              <span className="font-mono font-bold text-slate-200">{totalAdvances.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>المسدد:</span>
              <span className="font-mono text-emerald-400">{paidAdvances.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>المتبقي للسداد:</span>
              <span className="font-mono font-bold text-amber-400">{remainingAdvances.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        </div>

        {/* Block C: Payrolls Overview */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-sky-400" />
              المرتبات (كافة الفترات)
            </span>
            <Badge variant="outline" className="text-[10px]">
              {empPayrolls.length} مسير
            </Badge>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-slate-800/80">
            <div className="flex justify-between">
              <span>إجمالي المستحق:</span>
              <span className="font-mono font-bold text-slate-200">{totalDuePayrolls.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>إجمالي المدفوع:</span>
              <span className="font-mono text-emerald-400">{totalPaidPayrolls.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>إجمالي المتبقي:</span>
              <span className="font-mono font-bold text-rose-400">{totalRemainingPayrolls.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active Advances List if any */}
      {activeAdvances.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            السلف النشطة قيد السداد ({activeAdvances.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeAdvances.map((adv) => (
              <div
                key={adv.id}
                className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-slate-100">{adv.amount.toLocaleString('ar-EG')} ج.م</span>
                    <Badge variant="secondary" className="text-[9px]">
                      {adv.repaymentType === 'installments' ? `${adv.numberOfInstallments} أقساط` : 'خصم كامل'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-0.5">
                    متبقي: {adv.remainingAmount.toLocaleString('ar-EG')} ج.م • قسط: {adv.installmentAmount.toLocaleString('ar-EG')} ج.م
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelAdvanceClick(adv)}
                  className="h-7 text-[10px] text-rose-400 hover:bg-rose-500/10"
                >
                  إلغاء
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Financial Transactions History / Timeline */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-bold text-slate-300">سجل المعاملات المالية</h4>
        <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-800">
          <Table>
            <TableHeader className="bg-slate-900/60">
              <TableRow className="border-slate-800 text-[11px]">
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">نوع المعاملة</TableHead>
                <TableHead className="text-center">الشهر</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
                <TableHead className="text-right">البيان / الملاحظات</TableHead>
                <TableHead className="text-right">المستخدم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    لا توجد معاملات مالية مسجلة لهذا الموظف حتى الآن
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-slate-800/60 text-xs">
                    <TableCell className="font-mono text-[11px]">{tx.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {tx.typeName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-[11px]">
                      {tx.period || '-'}
                    </TableCell>
                    <TableCell className="text-left font-mono font-bold">
                      <span className={tx.isCredit ? 'text-amber-400' : 'text-emerald-400'}>
                        {tx.isCredit ? '+' : '-'}{tx.amount.toLocaleString('ar-EG')} ج.م
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px] max-w-[180px] truncate">
                      {tx.notes || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      {tx.user || 'المدير'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Advance Modal */}
      <AdvanceModal
        open={isAdvanceModalOpen}
        onOpenChange={setIsAdvanceModalOpen}
        employees={[{ id: employee.id, name: employee.name, role: employee.role }]}
        defaultEmployeeId={employee.id}
        onSaveAdvance={onCreateAdvance}
      />
    </div>
  );
};
