import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addExpense } from '@/services/expenses';
import { useTenantBranch } from '@/hooks/useDatabase';
import type { ExpenseCategory } from '@/types/expenses';

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  amount: number;
  category: ExpenseCategory;
  description: string;
  date: string;
}

const CATEGORIES: ExpenseCategory[] = ['رواتب', 'مشتريات', 'صيانة', 'أخرى'];

export function AddExpenseDialog({ open, onOpenChange, onSuccess }: AddExpenseDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { tenantId, branchId } = useTenantBranch();
  
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<FormData>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      amount: 0,
    }
  });

  const categoryValue = watch('category');

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      await addExpense({
        amount: Number(data.amount),
        category: data.category,
        description: data.description,
        date: data.date,
        createdBy: user.uid,
        branchId: branchId || tenantId || undefined,
        tenantId: tenantId || undefined,
      });

      toast({
        title: 'تمت الإضافة',
        description: 'تم إضافة المصروف بنجاح',
      });
      
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة المصروف',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) reset();
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>إضافة مصروف جديد</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              disabled={isSubmitting}
              {...register('amount', { required: 'يرجى إدخال المبلغ', min: { value: 0.01, message: 'يجب أن يكون المبلغ أكبر من صفر' } })}
            />
            {errors.amount && <span className="text-xs text-destructive">{errors.amount.message}</span>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">التصنيف</Label>
            <Select 
              disabled={isSubmitting}
              value={categoryValue} 
              onValueChange={(val: ExpenseCategory) => setValue('category', val, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر التصنيف..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('category', { required: 'يرجى اختيار التصنيف' })} />
            {errors.category && <span className="text-xs text-destructive">{errors.category.message}</span>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">التاريخ</Label>
            <Input
              id="date"
              type="date"
              disabled={isSubmitting}
              {...register('date', { required: 'يرجى إدخال التاريخ' })}
            />
            {errors.date && <span className="text-xs text-destructive">{errors.date.message}</span>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">البيان (الوصف)</Label>
            <Textarea
              id="description"
              disabled={isSubmitting}
              {...register('description', { required: 'يرجى إدخال الوصف' })}
            />
            {errors.description && <span className="text-xs text-destructive">{errors.description.message}</span>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
