import { describe, it, expect } from 'vitest';
import {
  calculateEmployeePayroll,
  calculateAdvanceDueInstallment,
  applyAdvanceDeduction,
} from '../lib/payrollEngine';
import type { Advance, SalaryPayment } from '../types/payroll';

describe('Payroll Engine Test Suite', () => {
  // Scenario 27: Ahmed's Core Scenario
  it('Scenario 27: Correctly calculates Net Salary, multi-payments, and final Paid status for Ahmed', () => {
    const employee = {
      id: 'emp_ahmed',
      name: 'أحمد محمد',
      role: 'كاشير',
      salary: 8000,
    };

    const advance: Advance = {
      id: 'adv_1',
      tenant_id: 'tenant_1',
      employeeId: 'emp_ahmed',
      employeeName: 'أحمد محمد',
      amount: 2000,
      paidAmount: 0,
      remainingAmount: 2000,
      repaymentType: 'installments',
      installmentAmount: 500,
      numberOfInstallments: 4,
      remainingInstallments: 4,
      startDate: '2026-09-01',
      paymentMethod: 'cash',
      status: 'active',
      deductedPeriods: [],
      createdAt: '2026-09-01T10:00:00.000Z',
      createdBy: 'admin',
    };

    // Attendance records that yield exactly 200 EGP deduction
    // Daily rate = 8000/30 = 266.67, Hourly rate = 33.33
    // Late minutes = 360 mins (6 hours) * 33.33 = 200 EGP
    const attendanceRecords = [
      {
        employeeId: 'emp_ahmed',
        date: '2026-09-05',
        status: 'late',
        lateMinutes: 360,
        hours: 8,
      },
      {
        employeeId: 'emp_ahmed',
        date: '2026-09-06',
        status: 'present',
        lateMinutes: 0,
        hours: 8,
      },
    ];

    const hrSettings = {
      late_deduction_enabled: true,
      overtime_enabled: false,
    };

    // Initial state before any payments
    const initialPayroll = calculateEmployeePayroll({
      employee,
      period: '2026-09',
      attendanceRecords,
      advances: [advance],
      payments: [],
      hrSettings,
    });

    expect(initialPayroll.basicSalarySnapshot).toBe(8000);
    expect(initialPayroll.attendanceDeductions).toBe(200);
    expect(initialPayroll.advanceDeductions).toBe(500);
    expect(initialPayroll.grossSalary).toBe(8000);
    expect(initialPayroll.netSalary).toBe(7300);
    expect(initialPayroll.totalPaid).toBe(0);
    expect(initialPayroll.remaining).toBe(7300);
    expect(initialPayroll.status).toBe('unpaid');

    // Payment #1: 3,000 EGP
    const payment1: SalaryPayment = {
      id: 'pay_1',
      tenant_id: 'tenant_1',
      payrollId: initialPayroll.id,
      employeeId: 'emp_ahmed',
      employeeName: 'أحمد محمد',
      payrollPeriod: '2026-09',
      amount: 3000,
      paymentMethod: 'cash',
      idempotencyKey: 'idemp_1',
      status: 'completed',
      createdAt: '2026-09-25T10:00:00.000Z',
      createdBy: 'admin',
    };

    const payrollAfterPayment1 = calculateEmployeePayroll({
      employee,
      period: '2026-09',
      attendanceRecords,
      advances: [advance],
      payments: [payment1],
      existingRecord: initialPayroll,
      hrSettings,
    });

    expect(payrollAfterPayment1.totalPaid).toBe(3000);
    expect(payrollAfterPayment1.remaining).toBe(4300);
    expect(payrollAfterPayment1.status).toBe('partial');

    // Payment #2: 4,300 EGP
    const payment2: SalaryPayment = {
      id: 'pay_2',
      tenant_id: 'tenant_1',
      payrollId: initialPayroll.id,
      employeeId: 'emp_ahmed',
      employeeName: 'أحمد محمد',
      payrollPeriod: '2026-09',
      amount: 4300,
      paymentMethod: 'bank_transfer',
      idempotencyKey: 'idemp_2',
      status: 'completed',
      createdAt: '2026-09-30T10:00:00.000Z',
      createdBy: 'admin',
    };

    const payrollAfterPayment2 = calculateEmployeePayroll({
      employee,
      period: '2026-09',
      attendanceRecords,
      advances: [advance],
      payments: [payment1, payment2],
      existingRecord: initialPayroll,
      hrSettings,
    });

    expect(payrollAfterPayment2.totalPaid).toBe(7300);
    expect(payrollAfterPayment2.remaining).toBe(0);
    expect(payrollAfterPayment2.status).toBe('paid');
  });

  // Scenario 28: 4-Month Advance Installments & No 5th Installment
  it('Scenario 28: Manages 4-month advance progression (2,000 on 500x4) and halts on 0 remaining', () => {
    let advance: Advance = {
      id: 'adv_loan_1',
      tenant_id: 'tenant_1',
      employeeId: 'emp_1',
      employeeName: 'سارة',
      amount: 2000,
      paidAmount: 0,
      remainingAmount: 2000,
      repaymentType: 'installments',
      installmentAmount: 500,
      numberOfInstallments: 4,
      remainingInstallments: 4,
      startDate: '2026-09-01',
      paymentMethod: 'cash',
      status: 'active',
      deductedPeriods: [],
      createdAt: '2026-09-01T10:00:00.000Z',
      createdBy: 'admin',
    };

    // Month 1: 2026-09
    const due1 = calculateAdvanceDueInstallment(advance, '2026-09');
    expect(due1).toBe(500);
    advance = applyAdvanceDeduction(advance, '2026-09', due1);
    expect(advance.paidAmount).toBe(500);
    expect(advance.remainingAmount).toBe(1500);
    expect(advance.remainingInstallments).toBe(3);
    expect(advance.status).toBe('partially_paid');

    // Trying to deduct again in Month 1 returns 0 (Idempotency)
    const duplicateDueMonth1 = calculateAdvanceDueInstallment(advance, '2026-09');
    expect(duplicateDueMonth1).toBe(0);

    // Month 2: 2026-10
    const due2 = calculateAdvanceDueInstallment(advance, '2026-10');
    expect(due2).toBe(500);
    advance = applyAdvanceDeduction(advance, '2026-10', due2);
    expect(advance.paidAmount).toBe(1000);
    expect(advance.remainingAmount).toBe(1000);
    expect(advance.remainingInstallments).toBe(2);

    // Month 3: 2026-11
    const due3 = calculateAdvanceDueInstallment(advance, '2026-11');
    expect(due3).toBe(500);
    advance = applyAdvanceDeduction(advance, '2026-11', due3);
    expect(advance.paidAmount).toBe(1500);
    expect(advance.remainingAmount).toBe(500);
    expect(advance.remainingInstallments).toBe(1);

    // Month 4: 2026-12
    const due4 = calculateAdvanceDueInstallment(advance, '2026-12');
    expect(due4).toBe(500);
    advance = applyAdvanceDeduction(advance, '2026-12', due4);
    expect(advance.paidAmount).toBe(2000);
    expect(advance.remainingAmount).toBe(0);
    expect(advance.remainingInstallments).toBe(0);
    expect(advance.status).toBe('fully_paid');

    // Month 5: 2027-01 (Cannot create 5th installment)
    const due5 = calculateAdvanceDueInstallment(advance, '2027-01');
    expect(due5).toBe(0);
  });

  // Scenario 30: Historical Snapshot Protection
  it('Scenario 30: Modifying current employee salary later does not alter previously generated payroll record', () => {
    const historicalPayrollRecord = {
      id: 'payroll_emp1_2026_01',
      tenant_id: 'tenant_1',
      employeeId: 'emp_1',
      employeeName: 'أحمد',
      period: '2026-01',
      year: 2026,
      month: 1,
      basicSalarySnapshot: 7000, // Salary back in January was 7,000
      grossSalary: 7000,
      netSalary: 7000,
      totalPaid: 7000,
      remaining: 0,
      status: 'paid' as const,
      attendanceDeductions: 0,
      advanceDeductions: 0,
      manualDeductions: 0,
      allowances: 0,
      overtime: 0,
      bonuses: 0,
    };

    // Employee gets salary raised to 8,000 in February
    const updatedEmployee = {
      id: 'emp_1',
      name: 'أحمد',
      salary: 8000,
    };

    // Re-calculating January with the existing record preserved
    const recheckedJanuary = calculateEmployeePayroll({
      employee: updatedEmployee,
      period: '2026-01',
      attendanceRecords: [],
      advances: [],
      payments: [
        {
          id: 'p1',
          tenant_id: 'tenant_1',
          payrollId: 'payroll_emp1_2026_01',
          employeeId: 'emp_1',
          employeeName: 'أحمد',
          payrollPeriod: '2026-01',
          amount: 7000,
          paymentMethod: 'cash',
          idempotencyKey: 'k1',
          status: 'completed',
          createdAt: '',
          createdBy: '',
        },
      ],
      existingRecord: historicalPayrollRecord,
    });

    // Must still be 7000, not 8000!
    expect(recheckedJanuary.basicSalarySnapshot).toBe(7000);
    expect(recheckedJanuary.netSalary).toBe(7000);
    expect(recheckedJanuary.remaining).toBe(0);
    expect(recheckedJanuary.status).toBe('paid');
  });

  // Scenario 29 Edge Cases:
  it('Scenario 29.1: Handles employee without salary (salary = 0)', () => {
    const zeroSalaryEmp = {
      id: 'emp_intern',
      name: 'متدرب',
      salary: 0,
    };

    const payroll = calculateEmployeePayroll({
      employee: zeroSalaryEmp,
      period: '2026-09',
      attendanceRecords: [],
      advances: [],
      payments: [],
    });

    expect(payroll.basicSalarySnapshot).toBe(0);
    expect(payroll.grossSalary).toBe(0);
    expect(payroll.netSalary).toBe(0);
    expect(payroll.remaining).toBe(0);
    expect(payroll.status).toBe('unpaid');
  });

  it('Scenario 29.2: Correctly calculates overtime when overtime_enabled is true', () => {
    const emp = {
      id: 'emp_chef',
      name: 'شيف',
      salary: 9000, // 300 daily, 37.5 hourly
    };

    // 1 attended day with 12 hours worked (4 hours overtime)
    const attendanceRecords = [
      {
        employeeId: 'emp_chef',
        date: '2026-09-10',
        status: 'present',
        hours: 12,
        lateMinutes: 0,
      },
    ];

    const payroll = calculateEmployeePayroll({
      employee: emp,
      period: '2026-09',
      attendanceRecords,
      advances: [],
      payments: [],
      hrSettings: {
        overtime_enabled: true,
      },
    });

    // 4 overtime hours * 37.5 * 1.5 = 225 EGP
    expect(payroll.overtime).toBe(225);
    expect(payroll.grossSalary).toBe(9225);
    expect(payroll.netSalary).toBe(9225);
  });

  it('Scenario 29.3: Prevents negative Net Salary when deductions exceed gross salary', () => {
    const emp = {
      id: 'emp_debt',
      name: 'موظف بخصومات عالية',
      salary: 3000,
    };

    const advance: Advance = {
      id: 'adv_heavy',
      tenant_id: 't1',
      employeeId: 'emp_debt',
      employeeName: 'موظف بخصومات عالية',
      amount: 5000,
      paidAmount: 0,
      remainingAmount: 5000,
      repaymentType: 'next_salary',
      installmentAmount: 5000,
      numberOfInstallments: 1,
      remainingInstallments: 1,
      startDate: '2026-09-01',
      paymentMethod: 'cash',
      status: 'active',
      deductedPeriods: [],
      createdAt: '',
      createdBy: '',
    };

    const payroll = calculateEmployeePayroll({
      employee: emp,
      period: '2026-09',
      attendanceRecords: [],
      advances: [advance],
      payments: [],
    });

    expect(payroll.grossSalary).toBe(3000);
    expect(payroll.advanceDeductions).toBe(5000);
    // Net salary cannot be negative
    expect(payroll.netSalary).toBe(0);
    expect(payroll.remaining).toBe(0);
  });
});
