import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import VehicleSwitcher from '../components/VehicleSwitcher';

export default function ExpensesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicleId, setVehicleId] = useState<string | null>(localStorage.getItem('selectedVehicleId'));
  const [expenses, setExpenses] = useState<any[]>([]);
  const [periodicExpenses, setPeriodicExpenses] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPeriodicForm, setShowPeriodicForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [tab, setTab] = useState<'expenses' | 'periodic' | 'maintenance' | 'types' | 'incomes'>('expenses');

  // Form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseTypeId, setExpenseTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Periodic form state
  const [pExpenseTypeId, setPExpenseTypeId] = useState('');
  const [pAmount, setPAmount] = useState('');
  const [pPeriod, setPPeriod] = useState('monthly');
  const [pStartDate, setPStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [pEndDate, setPEndDate] = useState('');
  const [pNote, setPNote] = useState('');
  const [editPeriodic, setEditPeriodic] = useState<any>(null);

  // Maintenance form state
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [editMaintenance, setEditMaintenance] = useState<any>(null);
  const [mRecordTime, setMRecordTime] = useState(new Date().toISOString().slice(0, 16));
  const [mAmount, setMAmount] = useState('');
  const [mMileage, setMMileage] = useState('');
  const [mItems, setMItems] = useState<string[]>([]);
  const [mCustomItems, setMCustomItems] = useState('');
  const [mNote, setMNote] = useState('');
  const [mRecordAsExpense, setMRecordAsExpense] = useState(true);

  /** 小熊油耗预设保养项目 */
  const MAINTENANCE_ITEMS = [
    '机油', '机油滤清器', '汽油滤清器', '空气滤清器', '空调滤芯', '空调除菌',
    '火花塞', '刹车油', '助力转向油', '变速箱油', '冷却液', '刹车片',
    '轮胎换位', '动平衡', '四轮定位', '换轮胎', '燃油系统清洗',
    '润滑系统清洗', '三元催化', '节气门',
  ];

  // Income form state
  const [iDate, setIDate] = useState(new Date().toISOString().slice(0, 10));
  const [iAmount, setIAmount] = useState('');
  const [iTypeName, setITypeName] = useState('');
  const [iNote, setINote] = useState('');

  // Expense type form state
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeColor, setTypeColor] = useState('#3B82F6');
  const [typeIsAmortized, setTypeIsAmortized] = useState(false);
  const [typeAmortizedMonths, setTypeAmortizedMonths] = useState('12');

  const handleVehicleSelect = (id: string) => {
    setVehicleId(id);
    localStorage.setItem('selectedVehicleId', id);
  };

  const loadExpenseTypes = useCallback(async () => {
    try {
      const data = await api.getExpenseTypes();
      setExpenseTypes(data);
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const [expData, periodicData, notesData, incomeData, maintenanceData] = await Promise.all([
        api.getExpenses(vehicleId),
        api.getPeriodicExpenses(vehicleId),
        api.getExpenseNotes(vehicleId),
        api.getIncomes(vehicleId),
        api.getMaintenanceRecords(vehicleId),
      ]);
      setExpenses(expData.expenses);
      setPeriodicExpenses(periodicData.periodicExpenses);
      setNotes(notesData.notes);
      setIncomes(incomeData.incomes);
      setMaintenanceRecords(maintenanceData.maintenanceRecords);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [vehicleId]);

  useEffect(() => { loadExpenseTypes(); }, [loadExpenseTypes]);
  useEffect(() => { loadData(); }, [loadData]);

  // 从底部导航"+"进入时自动打开添加表单
  useEffect(() => {
    if (searchParams.get('add') === '1' && vehicleId) {
      setTab('expenses');
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    setError('');
    setSubmitting(true);
    try {
      await api.createExpense(vehicleId, { date, expenseTypeId, amount: parseFloat(amount), note: note.trim() || undefined });
      setShowForm(false);
      setAmount('');
      setNote('');
      loadData();
    } catch (err: any) {
      setError(err.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePeriodicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    setError('');
    setSubmitting(true);
    const payload = {
      expenseTypeId: pExpenseTypeId,
      amount: parseFloat(pAmount),
      period: pPeriod,
      startDate: pStartDate,
      endDate: pEndDate,
      note: pNote.trim() || undefined,
    };
    try {
      if (editPeriodic) {
        await api.updatePeriodicExpense(editPeriodic.id, payload);
      } else {
        await api.createPeriodicExpense(vehicleId, payload);
      }
      setShowPeriodicForm(false);
      setEditPeriodic(null);
      setPAmount('');
      setPNote('');
      loadData();
    } catch (err: any) {
      setError(err.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openPeriodicForm = (pe?: any) => {
    setEditPeriodic(pe || null);
    if (pe) {
      setPExpenseTypeId(pe.expenseTypeId);
      setPAmount(String(pe.amount));
      setPPeriod(pe.period);
      setPStartDate(pe.startDate);
      setPEndDate(pe.endDate);
      setPNote(pe.note || '');
    } else {
      setPExpenseTypeId('');
      setPAmount('');
      setPPeriod('monthly');
      setPStartDate(new Date().toISOString().slice(0, 10));
      setPEndDate('');
      setPNote('');
    }
    setShowPeriodicForm(true);
  };

  const toggleMaintenanceItem = (item: string) => {
    setMItems((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));
  };

  const openMaintenanceForm = (record?: any) => {
    setEditMaintenance(record || null);
    if (record) {
      setMRecordTime(record.recordTime.slice(0, 16));
      setMAmount(String(record.amount));
      setMMileage(String(record.mileage));
      setMItems(record.items || []);
      setMCustomItems('');
      setMNote(record.note || '');
      setMRecordAsExpense(!!record.expenseId);
    } else {
      setMRecordTime(new Date().toISOString().slice(0, 16));
      setMAmount('');
      setMMileage('');
      setMItems([]);
      setMCustomItems('');
      setMNote('');
      setMRecordAsExpense(true);
    }
    setShowMaintenanceForm(true);
  };

  const allMaintenanceItems = () => {
    const custom = mCustomItems.split(/[\s,，、]+/).map((s) => s.trim()).filter(Boolean);
    return [...mItems, ...custom.filter((c) => !mItems.includes(c))];
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    setError('');
    const items = allMaintenanceItems();
    if (items.length === 0) {
      setError('请至少选择或输入一个保养项目');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        recordTime: mRecordTime,
        amount: parseFloat(mAmount) || 0,
        mileage: parseFloat(mMileage),
        items,
        note: mNote.trim() || undefined,
        recordAsExpense: mRecordAsExpense,
      };
      if (editMaintenance) {
        await api.updateMaintenance(editMaintenance.id, payload);
      } else {
        await api.createMaintenance(vehicleId, payload);
      }
      setShowMaintenanceForm(false);
      loadData();
    } catch (err: any) {
      setError(err?.fields ? Object.values(err.fields)[0] as string : err.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMaintenance = async (record: any) => {
    const msg = record.expenseId
      ? '确定删除此保养记录？关联的费用记录将一并删除。'
      : '确定删除此保养记录？';
    if (!confirm(msg)) return;
    try { await api.deleteMaintenance(record.id); loadData(); } catch { }
  };

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) return;
    setError('');
    setSubmitting(true);
    try {
      await api.createIncome(vehicleId, {
        date: iDate,
        amount: parseFloat(iAmount),
        typeName: iTypeName.trim() || undefined,
        note: iNote.trim() || undefined,
      });
      setShowIncomeForm(false);
      setIAmount('');
      setITypeName('');
      setINote('');
      loadData();
    } catch (err: any) {
      setError(err.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!confirm('确定删除此收入记录？')) return;
    try { await api.deleteIncome(id); loadData(); } catch { }
  };

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createExpenseType({
        name: typeName.trim(),
        color: typeColor,
        isAmortized: typeIsAmortized,
        amortizedMonths: typeIsAmortized ? parseInt(typeAmortizedMonths) : undefined,
      });
      setShowTypeForm(false);
      setTypeName('');
      loadExpenseTypes();
    } catch (err: any) {
      setError(err.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('确定删除此费用记录？')) return;
    try { await api.deleteExpense(id); loadData(); } catch { }
  };

  const handleDeletePeriodic = async (id: string) => {
    if (!confirm('确定删除此周期费用？')) return;
    try { await api.deletePeriodicExpense(id); loadData(); } catch { }
  };

  const handleDeleteType = async (id: string, name: string) => {
    if (!confirm(`确定删除费用类型"${name}"？相关记录将被一起删除。`)) return;
    try { await api.deleteExpenseType(id); loadExpenseTypes(); loadData(); } catch { }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">费用详情</h1>
        <div className="flex items-center gap-2">
          <VehicleSwitcher selectedVehicleId={vehicleId} onSelect={handleVehicleSelect} />
          <button
            onClick={() => navigate('/expenses')}
            className="border border-blue-600 text-blue-600 rounded-lg px-3 min-h-[44px] text-sm"
          >
            总览
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4 overflow-x-auto">
        {[{ key: 'expenses', label: '费用记录' }, { key: 'periodic', label: '周期费用' }, { key: 'maintenance', label: '保养记录' }, { key: 'incomes', label: '收入' }, { key: 'types', label: '费用类型' }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 min-h-[44px] text-sm whitespace-nowrap ${tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* Expense Records Tab */}
      {tab === 'expenses' && (
        <>
          {vehicleId && (
            <button onClick={() => setShowForm(true)} className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4 min-h-[44px]">
              + 添加费用
            </button>
          )}
          {showForm && (
            <form onSubmit={handleExpenseSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">日期</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">金额</label>
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">费用类型</label>
                <select value={expenseTypeId} onChange={(e) => setExpenseTypeId(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required>
                  <option value="">选择类型</option>
                  {expenseTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备注</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" list="note-suggestions" />
                <datalist id="note-suggestions">
                  {notes.map((n, i) => <option key={i} value={n} />)}
                </datalist>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">保存</button>
                <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
              </div>
            </form>
          )}
          {!vehicleId ? <div className="text-center py-8 text-gray-400">请先选择车辆</div>
            : loading ? <div className="text-center py-8 text-gray-400">加载中...</div>
            : expenses.length === 0 ? <div className="text-center py-8 text-gray-400">暂无费用记录</div>
            : <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-medium">¥{exp.amount.toFixed(2)} <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: exp.expenseTypeColor + '20', color: exp.expenseTypeColor }}>{exp.expenseTypeName}</span></p>
                    <p className="text-xs text-gray-400">{exp.date}{exp.note ? ` · ${exp.note}` : ''}</p>
                  </div>
                  <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">🗑️</button>
                </div>
              ))}
            </div>
          }
        </>
      )}

      {/* Periodic Expenses Tab */}
      {tab === 'periodic' && (
        <>
          {vehicleId && (
            <button onClick={() => openPeriodicForm()} className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4 min-h-[44px]">
              + 添加周期费用
            </button>
          )}
          {showPeriodicForm && (
            <form onSubmit={handlePeriodicSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
              <h3 className="font-semibold">{editPeriodic ? '编辑周期费用' : '添加周期费用'}</h3>
              <div>
                <label className="block text-sm text-gray-600 mb-1">费用类型</label>
                <select value={pExpenseTypeId} onChange={(e) => setPExpenseTypeId(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required>
                  <option value="">选择类型</option>
                  {expenseTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">金额</label>
                  <input type="number" step="0.01" value={pAmount} onChange={(e) => setPAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">周期</label>
                  <select value={pPeriod} onChange={(e) => setPPeriod(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]">
                    <option value="daily">每日</option>
                    <option value="monthly">每月</option>
                    <option value="yearly">每年</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">开始日期</label>
                  <input type="date" value={pStartDate} onChange={(e) => setPStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">结束日期</label>
                  <input type="date" value={pEndDate} onChange={(e) => setPEndDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
              </div>
              <p className="text-xs text-gray-400">登记后系统会在每个周期自动生成费用记录，无需手动记账。开始日期决定扣费日（每月按日、每年按月-日）。</p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备注（会作为自动生成费用记录的备注）</label>
                <input type="text" value={pNote} onChange={(e) => setPNote(e.target.value)} maxLength={200} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="如 特斯拉娱乐服务包" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">保存</button>
                <button type="button" onClick={() => { setShowPeriodicForm(false); setEditPeriodic(null); }} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
              </div>
            </form>
          )}
          {!vehicleId ? <div className="text-center py-8 text-gray-400">请先选择车辆</div>
            : periodicExpenses.length === 0 ? <div className="text-center py-8 text-gray-400">暂无周期费用</div>
            : <div className="space-y-2">
              {periodicExpenses.map((pe) => (
                <div key={pe.id} className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-medium">¥{pe.amount.toFixed(2)} / {pe.period === 'daily' ? '天' : pe.period === 'yearly' ? '年' : '月'}</p>
                    <p className="text-xs text-gray-400">{pe.startDate} ~ {pe.endDate} · {pe.expenseTypeName}{pe.note ? ` · ${pe.note}` : ''}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openPeriodicForm(pe)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600" aria-label="编辑">✏️</button>
                    <button onClick={() => handleDeletePeriodic(pe.id)} className="text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          }
        </>
      )}

      {/* Maintenance Tab */}
      {tab === 'maintenance' && (
        <>
          {vehicleId && (
            <button onClick={() => openMaintenanceForm()} className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4 min-h-[44px]">
              + 添加保养记录
            </button>
          )}
          {showMaintenanceForm && (
            <form onSubmit={handleMaintenanceSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
              <h3 className="font-semibold">{editMaintenance ? '编辑保养记录' : '添加保养记录'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">保养时间</label>
                  <input type="datetime-local" value={mRecordTime} onChange={(e) => setMRecordTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">支出（元，0 表示免费）</label>
                  <input type="number" step="0.01" min="0" value={mAmount} onChange={(e) => setMAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">当前里程 (km)</label>
                <input type="number" step="0.1" min="0" value={mMileage} onChange={(e) => setMMileage(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">保养项目（点选）</label>
                <div className="flex flex-wrap gap-2">
                  {MAINTENANCE_ITEMS.map((item) => {
                    const on = mItems.includes(item);
                    return (
                      <button key={item} type="button" onClick={() => toggleMaintenanceItem(item)}
                        className={`px-3 py-1.5 rounded-full text-sm min-h-[36px] border ${on ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                        {item}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={mCustomItems}
                  onChange={(e) => setMCustomItems(e.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 mt-2 text-sm"
                  placeholder="自定义保养项目，空格分隔"
                />
              </div>
              <label className="flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" checked={mRecordAsExpense} onChange={(e) => setMRecordAsExpense(e.target.checked)} />
                <span className="text-sm">记录为费用（计入"维修保养"费用统计）</span>
              </label>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备注</label>
                <textarea value={mNote} onChange={(e) => setMNote(e.target.value)} maxLength={1000} rows={2}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">
                  {submitting ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => setShowMaintenanceForm(false)} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
              </div>
            </form>
          )}
          {!vehicleId ? <div className="text-center py-8 text-gray-400">请先选择车辆</div>
            : loading ? <div className="text-center py-8 text-gray-400">加载中...</div>
            : maintenanceRecords.length === 0 ? <div className="text-center py-8 text-gray-400">暂无保养记录</div>
            : <div className="space-y-3">
              {maintenanceRecords.map((r) => (
                <div key={r.id} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {r.recordTime?.slice(0, 16).replace('T', ' ')} · {Number(r.mileage).toFixed(0)} km
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(r.items || []).map((item: string) => (
                          <span key={item} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{item}</span>
                        ))}
                      </div>
                      {r.note && <p className="text-xs text-gray-400 mt-1">{r.note}</p>}
                      {r.expenseId && <p className="text-xs text-green-600 mt-1">已计入费用记录</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-500">¥{Number(r.amount).toFixed(2)}</p>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => openMaintenanceForm(r)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600"
                          aria-label="编辑"
                        >✏️</button>
                        <button
                          onClick={() => handleDeleteMaintenance(r)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500"
                          aria-label="删除"
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </>
      )}

      {/* Incomes Tab */}
      {tab === 'incomes' && (
        <>
          {vehicleId && (
            <button onClick={() => setShowIncomeForm(true)} className="w-full bg-green-600 text-white py-2 rounded-lg mb-4 min-h-[44px]">
              + 添加收入
            </button>
          )}
          {showIncomeForm && (
            <form onSubmit={handleIncomeSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">日期</label>
                  <input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">金额</label>
                  <input type="number" step="0.01" value={iAmount} onChange={(e) => setIAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">收入类型（选填）</label>
                <input type="text" value={iTypeName} onChange={(e) => setITypeName(e.target.value)} maxLength={20} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="如 卖车、保险理赔" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备注</label>
                <input type="text" value={iNote} onChange={(e) => setINote(e.target.value)} maxLength={200} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-green-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">保存</button>
                <button type="button" onClick={() => setShowIncomeForm(false)} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
              </div>
            </form>
          )}
          {!vehicleId ? <div className="text-center py-8 text-gray-400">请先选择车辆</div>
            : incomes.length === 0 ? <div className="text-center py-8 text-gray-400">暂无收入记录</div>
            : <div className="space-y-2">
              {incomes.map((inc) => (
                <div key={inc.id} className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-medium text-green-600">+¥{inc.amount.toFixed(2)}{inc.typeName ? <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">{inc.typeName}</span> : ''}</p>
                    <p className="text-xs text-gray-400">{inc.date}{inc.note ? ` · ${inc.note}` : ''}</p>
                  </div>
                  <button onClick={() => handleDeleteIncome(inc.id)} className="text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">🗑️</button>
                </div>
              ))}
            </div>
          }
        </>
      )}

      {/* Expense Types Tab */}
      {tab === 'types' && (
        <>
          <button onClick={() => setShowTypeForm(true)} className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4 min-h-[44px]">
            + 添加费用类型
          </button>
          {showTypeForm && (
            <form onSubmit={handleTypeSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">名称</label>
                <input type="text" value={typeName} onChange={(e) => setTypeName(e.target.value)} maxLength={20} className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">颜色</label>
                <input type="color" value={typeColor} onChange={(e) => setTypeColor(e.target.value)} className="w-16 h-10 border rounded" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isAmortized" checked={typeIsAmortized} onChange={(e) => setTypeIsAmortized(e.target.checked)} />
                <label htmlFor="isAmortized" className="text-sm">需要分摊</label>
                {typeIsAmortized && (
                  <input type="number" min="1" max="60" value={typeAmortizedMonths} onChange={(e) => setTypeAmortizedMonths(e.target.value)} className="w-16 border rounded px-2 py-1" />
                )}
                {typeIsAmortized && <span className="text-xs text-gray-400">个月</span>}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">保存</button>
                <button type="button" onClick={() => setShowTypeForm(false)} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
              </div>
            </form>
          )}
          <div className="space-y-2">
            {expenseTypes.map((t) => (
              <div key={t.id} className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                  <span>{t.name}</span>
                  {t.isAmortized && <span className="text-xs text-gray-400">({t.amortizedMonths}月分摊)</span>}
                </div>
                <button onClick={() => handleDeleteType(t.id, t.name)} className="text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">🗑️</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
