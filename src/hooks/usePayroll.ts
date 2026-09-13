import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import type {
  PayrollRecord,
  PayrollPeriod,
  SalaryPayment,
  Advance,
  AdvanceInstallment,
  PaymentMethod,
  AdvanceRepaymentType,
  PayrollKPIs,
} from '@/types/payroll';
import {
  calculateEmployeePayroll,
  calculateAdvanceDueInstallment,
  applyAdvanceDeduction,
  type EmployeeData,
  type AttendanceRecordData,
} from '@/lib/payrollEngine';
import { toast } from 'sonner';

/**
 * Deeply strips undefined values from an object or array to prevent Firestore
 * "Unsupported field value: undefined" errors.
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result;
}

export function usePayroll(tenantId: string | null, branchId?: string | null) {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [advanceInstallments, setAdvanceInstallments] = useState<AdvanceInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  // In-flight payment lock to prevent double-click race conditions
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchAllPayrollData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [payrollsSnap, paymentsSnap, advancesSnap, installmentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'payrolls'), where('tenant_id', '==', tenantId))),
        getDocs(query(collection(db, 'salary_payments'), where('tenant_id', '==', tenantId))),
        getDocs(query(collection(db, 'advances'), where('tenant_id', '==', tenantId))),
        getDocs(query(collection(db, 'advance_installments'), where('tenant_id', '==', tenantId))),
      ]);

      setPayrolls(
        payrollsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PayrollRecord[]
      );
      setSalaryPayments(
        paymentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SalaryPayment[]
      );
      setAdvances(
        advancesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Advance[]
      );
      setAdvanceInstallments(
        installmentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AdvanceInstallment[]
      );
    } catch (err: any) {
      console.error('Error fetching payroll data:', err);
      toast.error('خطأ أثناء جلب بيانات الرواتب');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchAllPayrollData();
  }, [fetchAllPayrollData]);

  /**
   * Generates or retrieves the calculated payroll records for all employees for a given period.
   */
  const getPayrollForPeriod = useCallback(
    (
      period: PayrollPeriod,
      employees: EmployeeData[],
      attendance: AttendanceRecordData[],
      hrSettings?: any
    ): PayrollRecord[] => {
      return employees.map((emp) => {
        // Find existing stored payroll snapshot if any
        const existing = payrolls.find(
          (p) => p.employeeId === emp.id && p.period === period
        );

        return calculateEmployeePayroll({
          employee: emp,
          period,
          attendanceRecords: attendance,
          advances,
          payments: salaryPayments,
          existingRecord: existing,
          hrSettings,
        });
      });
    },
    [payrolls, advances, salaryPayments]
  );

  /**
   * Disburses a salary payment (partial or full) with double-click protection,
   * idempotency key, Expense creation, advance deduction sealing, and audit logging.
   */
  const disburseSalaryPayment = async (options: {
    payroll: PayrollRecord;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    currentUser?: { uid?: string; email?: string; name?: string };
    allAdvances?: Advance[];
  }): Promise<boolean> => {
    const { payroll, amount, paymentMethod, referenceNumber, notes, currentUser } = options;

    if (!tenantId) {
      toast.error('لم يتم تحديد المطعم (Tenant)');
      return false;
    }

    if (amount <= 0) {
      toast.error('يجب أن يكون المبلغ المدفوع أكبر من صفر');
      return false;
    }

    if (amount > payroll.remaining) {
      toast.error(`المبلغ المدفوع (${amount} ج.م) يتجاوز المبلغ المتبقي المستحق (${payroll.remaining} ج.م)`);
      return false;
    }

    if (isSubmittingPayment) {
      toast.warning('عملية دفع قيد المعالجة بالفعل، يرجى الانتظار...');
      return false;
    }

    setIsSubmittingPayment(true);

    try {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      const idempotencyKey = `pay_${payroll.employeeId}_${payroll.period}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. Double check idempotency against existing payments
      const existingPayQuery = query(
        collection(db, 'salary_payments'),
        where('tenant_id', '==', tenantId),
        where('idempotencyKey', '==', idempotencyKey)
      );
      const existingSnap = await getDocs(existingPayQuery);
      if (!existingSnap.empty) {
        toast.warning('تم تنفيذ هذه العملية مسبقاً لمنع التكرار');
        setIsSubmittingPayment(false);
        return true;
      }

      // 2. Create Salary Payment Document
      const paymentRef = await addDoc(
        collection(db, 'salary_payments'),
        sanitizeForFirestore({
          tenant_id: tenantId,
          branch_id: branchId || payroll.branch_id || '',
          payrollId: payroll.id,
          employeeId: payroll.employeeId,
          employeeName: payroll.employeeName,
          payrollPeriod: payroll.period,
          amount: Number(amount),
          paymentMethod,
          referenceNumber: referenceNumber?.trim() || '',
          notes: notes?.trim() || '',
          idempotencyKey,
          status: 'completed',
          createdAt: nowIso,
          createdBy: currentUser?.name || currentUser?.email || 'المدير',
        })
      );

      const paymentId = paymentRef.id;

      // 3. Create Corresponding Expense Transaction (Category: 'رواتب')
      // Exactly 1 expense record per payment
      const expenseRef = await addDoc(
        collection(db, 'expenses'),
        sanitizeForFirestore({
          tenantId: tenantId,
          branchId: branchId || payroll.branch_id || '',
          amount: Number(amount),
          category: 'رواتب',
          description: `صرف راتب شهر ${payroll.period} للموظف ${payroll.employeeName}${notes ? ' - ' + notes : ''}`,
          date: todayStr,
          payment_id: paymentId,
          reference_id: `salary_payment_${paymentId}`,
          payroll_period: payroll.period,
          employee_id: payroll.employeeId,
          createdBy: currentUser?.uid || 'المدير',
          createdAt: nowIso,
        })
      );

      // 4. Link expenseId into salary payment
      await updateDoc(paymentRef, {
        expenseId: expenseRef.id,
      });

      // 5. Update / Save Payroll Record with new paid total & remaining
      const newTotalPaid = (payroll.totalPaid || 0) + Number(amount);
      const newRemaining = Math.max(0, payroll.netSalary - newTotalPaid);
      const newStatus = newRemaining === 0 ? 'paid' : 'partial';

      const payrollDocRef = doc(db, 'payrolls', payroll.id);
      await setDoc(
        payrollDocRef,
        sanitizeForFirestore({
          ...payroll,
          branch_id: branchId || payroll.branch_id || '',
          totalPaid: newTotalPaid,
          remaining: newRemaining,
          status: newStatus,
          updatedAt: nowIso,
        }),
        { merge: true }
      );

      // 6. Seal Advance Installments if not already sealed for this period
      const currentAdvances = options.allAdvances || advances;
      const empAdvances = currentAdvances.filter(
        (a) => a.employeeId === payroll.employeeId && a.status !== 'cancelled'
      );

      for (const adv of empAdvances) {
        if (!adv.deductedPeriods || !adv.deductedPeriods.includes(payroll.period)) {
          const installment = calculateAdvanceDueInstallment(adv, payroll.period);
          if (installment > 0) {
            // Create Advance Installment Document
            await addDoc(
              collection(db, 'advance_installments'),
              sanitizeForFirestore({
                tenant_id: tenantId,
                advanceId: adv.id,
                employeeId: payroll.employeeId,
                payrollId: payroll.id,
                period: payroll.period,
                amount: installment,
                status: 'paid',
                paidAt: nowIso,
                createdAt: nowIso,
              })
            );

            // Update Advance document
            const updatedAdv = applyAdvanceDeduction(adv, payroll.period, installment);
            await updateDoc(
              doc(db, 'advances', adv.id),
              sanitizeForFirestore({
                paidAmount: updatedAdv.paidAmount,
                remainingAmount: updatedAdv.remainingAmount,
                remainingInstallments: updatedAdv.remainingInstallments,
                status: updatedAdv.status,
                deductedPeriods: updatedAdv.deductedPeriods,
                updatedAt: nowIso,
              })
            );
          }
        }
      }

      // 7. Audit Log
      await addDoc(
        collection(db, 'audit_logs'),
        sanitizeForFirestore({
          tenant_id: tenantId,
          action: 'salary_paid',
          entity: 'salary_payment',
          target_id: paymentId,
          user: currentUser?.name || currentUser?.email || 'المدير',
          details: `صرف دفعة راتب للموظف ${payroll.employeeName} بقيمة ${amount} ج.م لشهر ${payroll.period} بطريقة ${paymentMethod}`,
          severity: 'info',
          created_at: nowIso,
        })
      );

      toast.success(`تم صرف الراتب بنجاح: ${amount.toLocaleString('ar-EG')} ج.م للموظف ${payroll.employeeName}`);
      await fetchAllPayrollData();
      return true;
    } catch (err: any) {
      console.error('Error disbursing salary payment:', err);
      toast.error('حدث خطأ أثناء صرف الراتب: ' + err.message);
      return false;
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  /**
   * Voids / Cancels a salary payment safely:
   * - Marks payment voided
   * - Deletes/voids corresponding expense
   * - Restores payroll remaining & status
   * - Adds audit log
   */
  const voidSalaryPayment = async (
    paymentId: string,
    reason: string,
    currentUser?: { name?: string; email?: string }
  ): Promise<boolean> => {
    if (!tenantId) return false;
    if (!reason?.trim()) {
      toast.error('يرجى تحديد سبب إلغاء الدفعة');
      return false;
    }

    try {
      const payment = salaryPayments.find((p) => p.id === paymentId);
      if (!payment || payment.status === 'voided') {
        toast.error('الدفعة غير موجودة أو تم إلغاؤها مسبقاً');
        return false;
      }

      const nowIso = new Date().toISOString();

      // 1. Mark payment voided
      await updateDoc(
        doc(db, 'salary_payments', paymentId),
        sanitizeForFirestore({
          status: 'voided',
          voidReason: reason.trim(),
          voidedAt: nowIso,
          voidedBy: currentUser?.name || currentUser?.email || 'المدير',
        })
      );

      // 2. Delete or void corresponding expense
      if (payment.expenseId) {
        await deleteDoc(doc(db, 'expenses', payment.expenseId)).catch(async () => {
          // If already removed or not found, search by payment_id
          const expQ = query(
            collection(db, 'expenses'),
            where('payment_id', '==', paymentId)
          );
          const expSnap = await getDocs(expQ);
          for (const d of expSnap.docs) {
            await deleteDoc(d.ref).catch(() => {});
          }
        });
      }

      // 3. Update Payroll Record
      const payroll = payrolls.find((p) => p.id === payment.payrollId);
      if (payroll) {
        const newTotalPaid = Math.max(0, (payroll.totalPaid || 0) - payment.amount);
        const newRemaining = Math.max(0, payroll.netSalary - newTotalPaid);
        const newStatus = newTotalPaid === 0 ? 'unpaid' : 'partial';

        await updateDoc(
          doc(db, 'payrolls', payroll.id),
          sanitizeForFirestore({
            totalPaid: newTotalPaid,
            remaining: newRemaining,
            status: newStatus,
            updatedAt: nowIso,
          })
        );
      }

      // 4. Audit Log
      await addDoc(
        collection(db, 'audit_logs'),
        sanitizeForFirestore({
          tenant_id: tenantId,
          action: 'salary_payment_voided',
          entity: 'salary_payment',
          target_id: paymentId,
          user: currentUser?.name || currentUser?.email || 'المدير',
          details: `إلغاء دفعة راتب للموظف ${payment.employeeName} بقيمة ${payment.amount} ج.م لشهر ${payment.payrollPeriod}. السبب: ${reason}`,
          severity: 'warning',
          created_at: nowIso,
        })
      );

      toast.success('تم إلغاء الدفعة وتصحيح المصروف والمسير بنجاح');
      await fetchAllPayrollData();
      return true;
    } catch (err: any) {
      console.error('Error voiding salary payment:', err);
      toast.error('حدث خطأ أثناء إلغاء الدفعة: ' + err.message);
      return false;
    }
  };

  /**
   * Creates a new advance for an employee
   */
  const createAdvance = async (advanceData: {
    employeeId: string;
    employeeName: string;
    amount: number;
    repaymentType: AdvanceRepaymentType;
    installmentAmount?: number;
    numberOfInstallments?: number;
    startDate: string;
    paymentMethod: PaymentMethod;
    notes?: string;
    currentUser?: { name?: string; email?: string };
  }): Promise<string | null> => {
    if (!tenantId) return null;

    try {
      const nowIso = new Date().toISOString();
      const amount = Number(advanceData.amount);
      const isInstallments = advanceData.repaymentType === 'installments';
      const numberOfInstallments = isInstallments ? Math.max(1, Number(advanceData.numberOfInstallments) || 1) : 1;
      const installmentAmount = isInstallments
        ? Math.round((amount / numberOfInstallments) * 100) / 100
        : amount;

      const docRef = await addDoc(
        collection(db, 'advances'),
        sanitizeForFirestore({
          tenant_id: tenantId,
          branch_id: branchId || '',
          employeeId: advanceData.employeeId,
          employeeName: advanceData.employeeName,
          amount,
          paidAmount: 0,
          remainingAmount: amount,
          repaymentType: advanceData.repaymentType,
          installmentAmount,
          numberOfInstallments,
          remainingInstallments: numberOfInstallments,
          startDate: advanceData.startDate,
          paymentMethod: advanceData.paymentMethod,
          status: 'active',
          deductedPeriods: [],
          notes: advanceData.notes?.trim() || '',
          createdAt: nowIso,
          createdBy: advanceData.currentUser?.name || advanceData.currentUser?.email || 'المدير',
        })
      );

      // Audit Log
      await addDoc(
        collection(db, 'audit_logs'),
        sanitizeForFirestore({
          tenant_id: tenantId,
          action: 'advance_created',
          entity: 'advance',
          target_id: docRef.id,
          user: advanceData.currentUser?.name || advanceData.currentUser?.email || 'المدير',
          details: `إنشاء سلفة جديدة للموظف ${advanceData.employeeName} بمبلغ ${amount} ج.م (${isInstallments ? numberOfInstallments + ' أقساط' : 'خصم كامل'})`,
          severity: 'info',
          created_at: nowIso,
        })
      );

      toast.success('تم تسجيل السلفة بنجاح');
      await fetchAllPayrollData();
      return docRef.id;
    } catch (err: any) {
      console.error('Error creating advance:', err);
      toast.error('حدث خطأ أثناء إضافة السلفة: ' + err.message);
      return null;
    }
  };

  /**
   * Cancels an advance
   */
  const cancelAdvance = async (
    advanceId: string,
    reason: string,
    currentUser?: { name?: string; email?: string }
  ): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      const adv = advances.find((a) => a.id === advanceId);
      if (!adv) {
        toast.error('السلفة غير موجودة');
        return false;
      }

      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'advances', advanceId), {
        status: 'cancelled',
        notes: `${adv.notes || ''} [تم الإلغاء: ${reason}]`,
        updatedAt: nowIso,
      });

      // Audit Log
      await addDoc(collection(db, 'audit_logs'), {
        tenant_id: tenantId,
        action: 'advance_cancelled',
        entity: 'advance',
        target_id: advanceId,
        user: currentUser?.name || currentUser?.email || 'المدير',
        details: `إلغاء سلفة للموظف ${adv.employeeName} بمبلغ ${adv.amount} ج.م. السبب: ${reason}`,
        severity: 'warning',
        created_at: nowIso,
      });

      toast.success('تم إلغاء السلفة بنجاح');
      await fetchAllPayrollData();
      return true;
    } catch (err: any) {
      console.error('Error cancelling advance:', err);
      toast.error('خطأ أثناء إلغاء السلفة: ' + err.message);
      return false;
    }
  };

  /**
   * Compute dashboard KPI cards for payroll
   */
  const getKPIs = (periodRecords: PayrollRecord[]): PayrollKPIs => {
    const totalPayroll = periodRecords.reduce((sum, p) => sum + p.netSalary, 0);
    const totalPaid = periodRecords.reduce((sum, p) => sum + p.totalPaid, 0);
    const totalRemaining = periodRecords.reduce((sum, p) => sum + p.remaining, 0);

    const activeAdvancesTotal = advances
      .filter((a) => a.status === 'active' || a.status === 'partially_paid')
      .reduce((sum, a) => sum + a.remainingAmount, 0);

    const employeesCount = periodRecords.length;

    return {
      totalPayroll,
      totalPaid,
      totalRemaining,
      activeAdvancesTotal,
      employeesCount,
    };
  };

  return {
    payrolls,
    salaryPayments,
    advances,
    advanceInstallments,
    loading,
    isSubmittingPayment,
    fetchAllPayrollData,
    getPayrollForPeriod,
    disburseSalaryPayment,
    voidSalaryPayment,
    createAdvance,
    cancelAdvance,
    getKPIs,
  };
}
