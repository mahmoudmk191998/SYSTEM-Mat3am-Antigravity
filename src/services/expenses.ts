import { db } from '@/lib/firebase';
import { collection, doc, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import type { Expense } from '@/types/expenses';

const COLLECTION_NAME = 'expenses';

export const getExpenses = async (tenantId?: string, branchId?: string, startDate?: string, endDate?: string) => {
  try {
    const expensesRef = collection(db, COLLECTION_NAME);
    let constraints: any[] = [];
    
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));
    if (branchId) constraints.push(where('branchId', '==', branchId));

    let q = constraints.length > 0 ? query(expensesRef, ...constraints) : query(expensesRef);

    const snapshot = await getDocs(q);
    let expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];

    // Sort in-memory desc by date to avoid Firebase composite index errors
    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (startDate && endDate) {
      // In-memory filter for dates
      expenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
    }
    return expenses;
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
};

export const addExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt'>) => {
  try {
    const expensesRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(expensesRef, {
      ...expenseData,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
};

export const updateExpense = async (id: string, updates: Partial<Expense>) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
};

export const deleteExpense = async (id: string) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};
