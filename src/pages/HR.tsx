import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { useFormatters } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  UserCog, Plus, Search, Calendar, Clock, CheckCircle, Users,
  Briefcase, DollarSign, Timer, Edit, Trash2, Eye, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHR, useTenantBranch } from '@/hooks/useDatabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

// Mock data removed

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success', on_leave: 'bg-warning/10 text-warning', inactive: 'bg-destructive/10 text-destructive',
  present: 'bg-success/10 text-success', late: 'bg-warning/10 text-warning', absent: 'bg-destructive/10 text-destructive',
};
const statusLabels: Record<string, string> = {
  active: 'نشط', on_leave: 'إجازة', inactive: 'غير نشط', present: 'حاضر', late: 'متأخر', absent: 'غائب',
};

export default function HR() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', department: '', phone: '', salary: '' });
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  const [isAddAttendanceOpen, setIsAddAttendanceOpen] = useState(false);
  const [newAttendance, setNewAttendance] = useState({ employee_id: '', checkIn: '', status: 'present' });
  
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', startTime: '', endTime: '', employees: 0, days: [] as string[] });
  
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);

  const { tenantId } = useTenantBranch();
  const { employees: dbEmployees, shifts: dbShifts, attendance: dbAttendance, addEmployee, updateEmployee, deleteEmployee, addAttendance, updateAttendance, addShift, deleteShift, loading } = useHR(tenantId);
  const { currency, number } = useFormatters();

  const employees = dbEmployees.map(e => ({
    id: e.id,
    name: e.name || '',
    role: e.role || '',
    department: e.department || '',
    phone: e.phone || '',
    salary: Number(e.salary) || 0,
    hireDate: e.hire_date || '',
    status: e.status || 'active'
  }));

  const shifts = dbShifts.length > 0 ? dbShifts : [];
  const attendance = dbAttendance.length > 0 ? dbAttendance : [];

  const filteredEmployees = employees.filter(e =>
    e.name.includes(searchQuery) || e.role.includes(searchQuery)
  );

  const handleBulkDeleteEmployees = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedEmployees.length} موظف؟`)) return;
    for (const id of selectedEmployees) {
      await deleteEmployee(id);
    }
    setSelectedEmployees([]);
  };

  const handleBulkDeleteShifts = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedShifts.length} وردية؟`)) return;
    for (const id of selectedShifts) {
      await deleteShift(id);
    }
    setSelectedShifts([]);
  };

  const activeCount = employees.filter(e => e.status === 'active').length;
  const totalSalaries = employees.reduce((sum, e) => sum + e.salary, 0);
  const presentToday = attendance.filter(a => a.status === 'present').length;

  return (
    <MainLayout
      title="الموارد البشرية والورديات"
      subtitle="إدارة الموظفين والجدولة"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 text-xs md:text-sm">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">جدول الورديات</span>
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 text-xs md:text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">موظف جديد</span>
          </Button>
        </div>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Users className="w-5 h-5 md:w-6 md:h-6" /></div><div><p className="text-xl md:text-2xl font-bold">{number(employees.length)}</p><p className="text-xs md:text-sm text-muted-foreground">إجمالي الموظفين</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-success/10 text-success flex items-center justify-center"><CheckCircle className="w-5 h-5 md:w-6 md:h-6" /></div><div><p className="text-xl md:text-2xl font-bold">{number(activeCount)}</p><p className="text-xs md:text-sm text-muted-foreground">نشطين</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-info/10 text-info flex items-center justify-center"><Timer className="w-5 h-5 md:w-6 md:h-6" /></div><div><p className="text-xl md:text-2xl font-bold">{number(presentToday)}</p><p className="text-xs md:text-sm text-muted-foreground">حاضرين اليوم</p></div></div></CardContent></Card>
        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center"><DollarSign className="w-5 h-5 md:w-6 md:h-6" /></div><div><p className="text-xl md:text-2xl font-bold">{currency(totalSalaries)}</p><p className="text-xs md:text-sm text-muted-foreground">إجمالي الرواتب</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="employees">الموظفون</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
          <TabsTrigger value="shifts">الورديات</TabsTrigger>
          <TabsTrigger value="roles">الأدوار</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex gap-2">
            {selectedEmployees.length > 0 && (
              <Button onClick={handleBulkDeleteEmployees} variant="destructive" className="gap-2 shrink-0">
                <Trash2 className="w-4 h-4" />
                حذف ({selectedEmployees.length})
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث عن موظف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
            </div>
            {filteredEmployees.length > 0 && (
              <div className="flex items-center gap-2 px-3 border rounded-md bg-background">
                <Checkbox
                  checked={selectedEmployees.length === filteredEmployees.length}
                  onCheckedChange={(c) => {
                    if (c) setSelectedEmployees(filteredEmployees.map(e => e.id));
                    else setSelectedEmployees([]);
                  }}
                />
                <span className="text-sm font-medium">الكل</span>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {filteredEmployees.map((employee) => (
              <Card key={employee.id} className="relative">
                <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={(c) => {
                      if (c) setSelectedEmployees(prev => [...prev, employee.id]);
                      else setSelectedEmployees(prev => prev.filter(id => id !== employee.id));
                    }}
                  />
                </div>
                <CardContent className="p-3 md:p-4 pr-10 md:pr-12">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 md:w-14 md:h-14">
                      <AvatarFallback className="text-sm md:text-lg bg-primary/10 text-primary">{employee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-sm md:text-lg">{employee.name}</h3>
                        <Badge className={cn('text-[10px] md:text-xs', statusColors[employee.status])}>{statusLabels[employee.status]}</Badge>
                      </div>
                      <p className="text-xs md:text-sm text-primary font-medium">{employee.role}</p>
                      <p className="text-[10px] md:text-sm text-muted-foreground">{employee.department} • {employee.phone}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                      <div className="text-center"><p className="text-lg font-bold">{currency(employee.salary)}</p><p className="text-xs text-muted-foreground">الراتب</p></div>
                      <div className="text-center"><p className="text-sm font-medium">{employee.hireDate}</p><p className="text-xs text-muted-foreground">تاريخ التعيين</p></div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingEmployee(employee)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={async () => {
                        if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
                          await deleteEmployee(employee.id);
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center justify-between flex-wrap gap-2"><span>سجل الحضور - اليوم</span><div className="flex gap-2"><Button onClick={() => setIsAddAttendanceOpen(true)} size="sm" className="gap-2"><Plus className="w-4 h-4" />إضافة حضور</Button><Button variant="outline" size="sm" className="gap-2"><Calendar className="w-4 h-4" />تغيير التاريخ</Button></div></CardTitle></CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>الحضور</TableHead><TableHead>الانصراف</TableHead><TableHead>الساعات</TableHead><TableHead>الإجراءات</TableHead></TableRow></TableHeader>
                <TableBody>
                  {attendance.map((record) => {
                    const emp = employees.find(e => e.id === record.employee_id);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{emp ? emp.name : 'موظف محذوف'}</TableCell>
                        <TableCell>{record.checkIn || '-'}</TableCell>
                        <TableCell>{record.checkOut || '-'}</TableCell>
                        <TableCell>{record.hours ? `${record.hours} ساعة` : '-'}</TableCell>
                        <TableCell>
                          {!record.checkOut && (
                             <Button size="sm" variant="outline" onClick={async () => {
                               const out = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                               const start = new Date(`2000/01/01 ${record.checkIn}`).getTime();
                               const end = new Date(`2000/01/01 ${out}`).getTime();
                               const hours = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;
                               await updateAttendance(record.id, { checkOut: out, hours: hours > 0 ? hours : 0 });
                             }}>تسجيل انصراف</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {attendance.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد سجلات اليوم</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          <div className="flex gap-2 items-center">
            {shifts.length > 0 && (
              <div className="flex items-center gap-2 px-3 border rounded-md bg-background h-10">
                <Checkbox
                  checked={selectedShifts.length === shifts.length}
                  onCheckedChange={(c) => {
                    if (c) setSelectedShifts(shifts.map((s: any) => s.id));
                    else setSelectedShifts([]);
                  }}
                />
                <span className="text-sm font-medium">الكل</span>
              </div>
            )}
            {selectedShifts.length > 0 && (
              <Button onClick={handleBulkDeleteShifts} variant="destructive" className="gap-2 shrink-0">
                <Trash2 className="w-4 h-4" />
                حذف ({selectedShifts.length})
              </Button>
            )}
            <div className="flex justify-end flex-1"><Button className="gap-2" onClick={() => setIsAddShiftOpen(true)}><Plus className="w-4 h-4" />وردية جديدة</Button></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((shift) => (
              <Card key={shift.id} className="relative group">
                <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedShifts.includes(shift.id)}
                    onCheckedChange={(c) => {
                      if (c) setSelectedShifts(prev => [...prev, shift.id]);
                      else setSelectedShifts(prev => prev.filter(id => id !== shift.id));
                    }}
                  />
                </div>
                <Button variant="ghost" size="icon" className="absolute top-2 left-10 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={async () => { if(confirm('تأكيد الحذف؟')) await deleteShift(shift.id); }}><Trash2 className="w-4 h-4"/></Button>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">{shift.name}</h3><Badge variant="outline">{shift.employees || 0} موظف</Badge></div>
                  <div className="flex items-center gap-2 mb-4 text-lg"><Clock className="w-5 h-5 text-muted-foreground" /><span className="font-medium">{shift.startTime}</span><span className="text-muted-foreground">-</span><span className="font-medium">{shift.endTime}</span></div>
                  <div className="flex flex-wrap gap-1">{(shift.days || []).map((day: string) => (<Badge key={day} variant="secondary" className="text-xs">{day}</Badge>))}</div>
                </CardContent>
              </Card>
            ))}
            {shifts.length === 0 && <div className="col-span-full py-10 text-center text-muted-foreground">لا توجد الورديات مضافة</div>}
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />الأدوار والصلاحيات</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {['مدير الفرع', 'كاشير', 'شيف', 'نادل', 'مساعد'].map((role) => (
                <div key={role} className="p-3 md:p-4 bg-muted rounded-lg flex items-center justify-between">
                  <div><h4 className="font-medium">{role}</h4><p className="text-sm text-muted-foreground">{employees.filter(e => e.role.includes(role.split(' ')[0])).length} موظف</p></div>
                  <Button variant="outline" size="sm">إدارة الصلاحيات</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">الاسم</label>
              <Input
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                placeholder="اسم الموظف"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">الدور الوظيفي</label>
              <Input
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                placeholder="(مثال: كاشير، شيف)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">القسم</label>
              <Input
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                placeholder="(مثال: المطبخ، الصالة)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">رقم الهاتف</label>
                <Input
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الراتب (بالجنيه)</label>
                <Input
                  type="number"
                  value={newEmployee.salary}
                  onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <Button
              className="w-full mt-4"
              disabled={!newEmployee.name || !newEmployee.role}
              onClick={async () => {
                const success = await addEmployee({
                  name: newEmployee.name,
                  role: newEmployee.role,
                  department: newEmployee.department,
                  phone: newEmployee.phone,
                  salary: Number(newEmployee.salary),
                  hire_date: new Date().toISOString().split('T')[0],
                  status: 'active'
                });
                if (success) {
                  setIsAddOpen(false);
                  setNewEmployee({ name: '', role: '', department: '', phone: '', salary: '' });
                }
              }}
            >
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الاسم</label>
                <Input
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  placeholder="اسم الموظف"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الدور الوظيفي</label>
                <Input
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  placeholder="(مثال: كاشير، شيف)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">القسم</label>
                <Input
                  value={editingEmployee.department}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                  placeholder="(مثال: المطبخ، الصالة)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">رقم الهاتف</label>
                  <Input
                    value={editingEmployee.phone}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    placeholder="رقم الهاتف"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الراتب (بالجنيه)</label>
                  <Input
                    type="number"
                    value={editingEmployee.salary}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, salary: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <Button
                className="w-full mt-4"
                disabled={!editingEmployee.name || !editingEmployee.role}
                onClick={async () => {
                  const success = await updateEmployee(editingEmployee.id, {
                    name: editingEmployee.name,
                    role: editingEmployee.role,
                    department: editingEmployee.department,
                    phone: editingEmployee.phone,
                    salary: Number(editingEmployee.salary),
                  });
                  if (success) {
                    setEditingEmployee(null);
                  }
                }}
              >
                تحديث
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddAttendanceOpen} onOpenChange={setIsAddAttendanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تسجيل حضور موظف</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">اسم الموظف</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newAttendance.employee_id} onChange={e => setNewAttendance({...newAttendance, employee_id: e.target.value})}>
                <option value="">-- اختر الموظف --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">وقت الحضور</label>
              <Input type="time" value={newAttendance.checkIn} onChange={e => setNewAttendance({...newAttendance, checkIn: e.target.value})} />
            </div>
            <Button className="w-full" disabled={!newAttendance.employee_id || !newAttendance.checkIn} onClick={async () => {
              const s = await addAttendance({ ...newAttendance, date: new Date().toISOString().split('T')[0] });
              if (s) { setIsAddAttendanceOpen(false); setNewAttendance({ employee_id: '', checkIn: '', status: 'present' }); }
            }}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة وردية جديدة</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><label className="text-sm font-medium">اسم الوردية</label><Input value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} placeholder="مثال: وردية الصباح" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">من الساعة</label><Input type="time" value={newShift.startTime} onChange={e => setNewShift({...newShift, startTime: e.target.value})} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">إلى الساعة</label><Input type="time" value={newShift.endTime} onChange={e => setNewShift({...newShift, endTime: e.target.value})} /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">عدد الموظفين المتوقع</label>
              <Input type="number" value={newShift.employees} onChange={e => setNewShift({...newShift, employees: parseInt(e.target.value) || 0})} />
            </div>
            <Button className="w-full" disabled={!newShift.name || !newShift.startTime || !newShift.endTime} onClick={async () => {
              const s = await addShift(newShift);
              if (s) { setIsAddShiftOpen(false); setNewShift({ name: '', startTime: '', endTime: '', employees: 0, days: [] }); }
            }}>حفظ التغييرات</Button>
          </div>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}
