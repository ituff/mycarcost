import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useVehicles } from '../hooks/useVehicles';
import VehicleSwitcher from '../components/VehicleSwitcher';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

type RangeKey = '3m' | '6m' | '1y' | 'thisYear' | 'all' | 'custom';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '3m', label: '三个月' },
  { key: '6m', label: '半年' },
  { key: '1y', label: '一年' },
  { key: 'thisYear', label: '今年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
];

function rangeToParams(range: RangeKey, custom: { start: string; end: string }): { startDate?: string; endDate?: string; all?: boolean } {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  if (range === 'all') return { all: true };
  if (range === 'custom') {
    if (custom.start && custom.end) return { startDate: custom.start, endDate: custom.end };
    return { all: true };
  }
  if (range === 'thisYear') return { startDate: `${now.getFullYear()}-01-01`, endDate };
  const months = { '3m': 3, '6m': 6, '1y': 12 }[range];
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

export default function ExpenseOverviewPage() {
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState<string | null>(localStorage.getItem('selectedVehicleId'));
  const { vehicles } = useVehicles();
  const [range, setRange] = useState<RangeKey>('1y');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null); // null = 全部
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleType = vehicle?.type;

  const handleVehicleSelect = (id: string) => {
    setVehicleId(id);
    localStorage.setItem('selectedVehicleId', id);
    setSelectedTypes(null);
  };

  const load = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const data = await api.getExpenseReport(vehicleId, rangeToParams(range, appliedCustom));
      setData(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [vehicleId, range, appliedCustom]);

  useEffect(() => { load(); }, [load]);

  // 类别清单（构成统计的顺序）
  const categories: { id: string; name: string; color: string }[] = useMemo(() => {
    if (!data?.breakdown) return [];
    return data.breakdown.map((b: any) => ({ id: b.typeId, name: b.typeName, color: b.typeColor }));
  }, [data]);

  useEffect(() => {
    // 数据刷新后若未手动筛选过，重置为全选
    setSelectedTypes(null);
  }, [vehicleId, range, appliedCustom]);

  const activeFilter = (id: string) => !selectedTypes || selectedTypes.has(id);

  const summary = data?.summary;
  const days = summary?.firstDate && summary?.lastDate
    ? Math.max(1, Math.round((new Date(summary.lastDate).getTime() - new Date(summary.firstDate).getTime()) / 86400000))
    : null;

  const showFuel = vehicleType === 'fuel' || vehicleType === 'hybrid';
  const showElectric = vehicleType === 'electric' || vehicleType === 'hybrid';
  const consumptionCost = vehicleType === 'electric' ? (data?.electricCost || 0) : (data?.fuelCost || 0);
  const expenseOnlyTotal = data
    ? data.breakdown.filter((b: any) => b.typeId !== '_consumption').reduce((s: number, b: any) => s + b.totalAmount, 0)
    : 0;

  // 月度堆叠柱状图
  const monthlyChart = useMemo(() => {
    if (!data?.monthlyByType?.length) return null;
    const filtered = data.monthlyByType.filter((r: any) => activeFilter(r.typeId));
    if (!filtered.length) return null;
    const months = Array.from(new Set<string>(filtered.map((r: any) => r.month))).sort();
    const byType = new Map<string, { name: string; color: string; amounts: number[] }>();
    for (const r of filtered) {
      if (!byType.has(r.typeId)) byType.set(r.typeId, { name: r.typeName, color: r.typeColor, amounts: Array(months.length).fill(0) });
      byType.get(r.typeId)!.amounts[months.indexOf(r.month)] += r.amount;
    }
    const monthTotals = months.map((m: string) =>
      filtered.filter((r: any) => r.month === m).reduce((s: number, r: any) => s + r.amount, 0)
    );
    const avg = monthTotals.reduce((s: number, v: number) => s + v, 0) / months.length;
    const datasets: any[] = [...byType.values()].map((t) => ({
      label: t.name,
      data: t.amounts.map((v) => Math.round(v * 100) / 100),
      backgroundColor: t.color,
      stack: 'expense',
      barPercentage: 0.7,
    }));
    if (months.length > 1) {
      datasets.push({
        type: 'line',
        label: '月均',
        data: Array(months.length).fill(Math.round(avg * 100) / 100),
        borderColor: '#ef4444',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
    }
    return {
      labels: months.map((m: string) => m.replace('-', '年') + '月'),
      datasets,
    };
  }, [data, selectedTypes]);

  const doughnutData = useMemo(() => {
    if (!data?.breakdown) return null;
    const filtered = data.breakdown.filter((b: any) => activeFilter(b.typeId));
    if (!filtered.length) return null;
    return {
      labels: filtered.map((b: any) => b.typeName),
      datasets: [{
        data: filtered.map((b: any) => b.totalAmount),
        backgroundColor: filtered.map((b: any) => b.typeColor),
        borderWidth: 1,
      }],
      total: filtered.reduce((s: number, b: any) => s + b.totalAmount, 0),
    };
  }, [data, selectedTypes]);

  const stackedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, ticks: { maxTicksLimit: 12, font: { size: 10 } } },
      y: { stacked: true, beginAtZero: true },
    },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">费用</h1>
        <div className="flex items-center gap-2">
          <VehicleSwitcher selectedVehicleId={vehicleId} onSelect={handleVehicleSelect} />
          <button
            onClick={() => navigate('/expenses/list')}
            className="border border-blue-600 text-blue-600 rounded-lg px-3 min-h-[44px] text-sm"
          >
            详情
          </button>
        </div>
      </div>

      {!vehicleId ? (
        <div className="text-center py-8 text-gray-400">请先选择车辆</div>
      ) : (
        <>
          {/* 时间筛选 */}
          <div className="bg-white rounded-lg p-3 shadow-sm mb-4">
            <div className="flex gap-1 flex-wrap">
              {RANGES.map((r) => (
                <button key={r.key}
                  onClick={() => {
                    if (r.key === 'custom' && range !== 'custom') {
                      if (!customStart || !customEnd) {
                        const now = new Date();
                        setCustomStart(`${now.getFullYear()}-01-01`);
                        setCustomEnd(now.toISOString().slice(0, 10));
                      }
                      return;
                    }
                    setRange(r.key);
                  }}
                  className={`px-2 py-1 rounded-full text-xs min-h-[32px] ${range === r.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-sm min-h-[36px]" />
                <span className="text-sm text-gray-400">至</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-sm min-h-[36px]" />
                <button
                  onClick={() => { if (customStart && customEnd) setAppliedCustom({ start: customStart, end: customEnd }); }}
                  disabled={!customStart || !customEnd}
                  className="bg-green-600 text-white rounded-lg px-3 py-1 text-sm min-h-[36px] disabled:opacity-50">
                  查询
                </button>
              </div>
            )}
          </div>

          {/* 统计 */}
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <p className="font-semibold mb-3">统计</p>
            {data ? (
              <>
                <div className="grid gap-y-3 mb-4" style={{ gridTemplateColumns: `repeat(${(showFuel ? 1 : 0) + (showElectric ? 1 : 0) + 2}, minmax(0, 1fr))` }}>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">总支出</p>
                    <p className="font-bold">{data.totalExpense.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">元</p>
                  </div>
                  {showFuel && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">油费总计</p>
                      <p className="font-bold">{data.fuelCost.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">元</p>
                    </div>
                  )}
                  {showElectric && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">电费总计</p>
                      <p className="font-bold">{data.electricCost.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">元</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xs text-gray-500">费用总计</p>
                    <p className="font-bold">{expenseOnlyTotal.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">元</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-y-4 text-center border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-xs text-gray-500">支出/公里</p>
                    <p className="font-bold">{data.totalDistance > 0 ? (data.totalExpense / data.totalDistance).toFixed(2) : '-'}</p>
                    <p className="text-xs text-gray-400">元</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{showElectric && !showFuel ? '电费/公里' : '能耗费/公里'}</p>
                    <p className="font-bold">{data.totalDistance > 0 ? (consumptionCost / data.totalDistance).toFixed(2) : '-'}</p>
                    <p className="text-xs text-gray-400">元</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">成本/天</p>
                    <p className="font-bold">{days ? (data.totalExpense / days).toFixed(2) : '-'}</p>
                    <p className="text-xs text-gray-400">元</p>
                  </div>
                </div>
                {days && (
                  <p className="text-xs text-gray-400 mt-2">
                    记录期间：{summary.firstDate} ~ {summary.lastDate}（{days} 天）
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">加载中...</p>
            )}
          </div>

          {/* 支出月度统计 */}
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <p className="font-semibold mb-2">支出月度统计（自然月）</p>
            {monthlyChart ? (
              <div className="h-64">
                <Bar data={monthlyChart} options={stackedOptions as any} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">当前范围内暂无费用数据</p>
            )}
          </div>

          {/* 类别筛选 */}
          {categories.length > 0 && (
            <div className="bg-white rounded-lg p-3 shadow-sm mb-4">
              <p className="text-xs text-gray-500 mb-2">类别筛选（点选切换，影响下方图表）</p>
              <div className="flex gap-1 flex-wrap">
                {categories.map((c) => {
                  const on = activeFilter(c.id);
                  return (
                    <button key={c.id}
                      onClick={() => {
                        const next = new Set(selectedTypes || new Set(categories.map((x) => x.id)));
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        setSelectedTypes(next.size ? next : null);
                      }}
                      className={`px-2 py-1 rounded-full text-xs min-h-[32px] ${on ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                      style={on ? { backgroundColor: c.color } : {}}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 费用构成 */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="font-semibold mb-2">费用构成统计</p>
            {doughnutData ? (
              <div className="relative h-64">
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } },
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: '3rem' }}>
                  <p className="text-lg font-bold">{doughnutData.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">费用总计</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">当前范围内暂无费用数据</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
