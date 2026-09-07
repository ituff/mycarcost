import { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

type RangeKey = '3m' | '6m' | '1y' | 'thisYear' | 'all' | 'custom';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '3m', label: '三个月' },
  { key: '6m', label: '半年' },
  { key: '1y', label: '一年' },
  { key: 'thisYear', label: '今年' },
  { key: 'all', label: '全部' },
  { key: 'custom', label: '自定义' },
];

const ALL_RANGE = { all: true };

function rangeToDates(range: RangeKey, custom: { start: string; end: string }): { startDate?: string; endDate?: string; all?: boolean } {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  if (range === 'all') return { ...ALL_RANGE };
  if (range === 'custom') {
    if (custom.start && custom.end) return { startDate: custom.start, endDate: custom.end };
    return { ...ALL_RANGE };
  }
  if (range === 'thisYear') return { startDate: `${now.getFullYear()}-01-01`, endDate };
  const months = { '3m': 3, '6m': 6, '1y': 12 }[range];
  const start = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

const typeLabels: Record<string, string> = { fuel: '燃油车', electric: '纯电车', hybrid: '插电混动' };

export default function ConsumptionOverviewPage() {
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState<string | null>(localStorage.getItem('selectedVehicleId'));
  const { vehicles } = useVehicles();
  const [range, setRange] = useState<RangeKey>('1y');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [autoFellBack, setAutoFellBack] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehicleType = vehicle?.type;

  const handleVehicleSelect = (id: string) => {
    setVehicleId(id);
    localStorage.setItem('selectedVehicleId', id);
    setAutoFellBack(false);
  };

  const load = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const params = rangeToDates(range, appliedCustom);
      const data = await api.getConsumptionReport(vehicleId, params);
      setData(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [vehicleId, range, appliedCustom]);

  useEffect(() => { load(); }, [load]);

  // 所选范围无数据但车辆有历史记录时，自动回退到"全部"
  useEffect(() => {
    if (
      !loading &&
      data?.summary &&
      data.summary.recordCount === 0 &&
      range !== 'all' &&
      (vehicle?.totalMileage || 0) > 0
    ) {
      setRange('all');
      setAutoFellBack(true);
    }
  }, [loading, data, range, vehicle]);

  const unit = vehicleType === 'fuel' ? { qty: 'L', cons: '油耗', cost: '油费', per: '升/百公里' }
    : { qty: '度', cons: '电耗', cost: '电费', per: '度/百公里' };

  // 最近一次能耗：时间排序后的最后一个有效数据点
  const latest = (() => {
    if (!data) return null;
    const points = [
      ...(data.fuel?.dataPoints || []),
      ...(data.electric?.dataPoints || []),
    ]
      .filter((p: any) => p.per100km != null)
      .sort((a: any, b: any) => a.recordTime.localeCompare(b.recordTime));
    return points.length ? points[points.length - 1] : null;
  })();

  const stats = (() => {
    if (!data || !data.summary?.firstRecord || !data.summary?.lastRecord) return null;
    const s = data.summary;
    const days = Math.max(1, Math.round(
      (new Date(s.lastRecord.recordTime).getTime() - new Date(s.firstRecord.recordTime).getTime()) / 86400000
    ));
    const distance = Math.max(0, s.lastRecord.mileage - s.firstRecord.mileage);
    const isElectric = vehicleType === 'electric';
    const totalQuantity = isElectric ? data.electric.totalQuantity : data.fuel.totalQuantity;
    const totalCost = (data.fuel?.totalCost || 0) + (data.electric?.totalCost || 0);
    return {
      avgConsumption: isElectric ? data.electric.averagePer100km : data.fuel.averagePer100km,
      avgTrip: distance / days,
      avgCostPerKm: distance > 0 ? totalCost / distance : null,
      totalDistance: distance,
      totalCost,
      totalQuantity,
    };
  })();

  const chartData = (() => {
    if (!data) return null;
    const datasets = [];
    const fuelPoints = (data.fuel?.dataPoints || []).filter((p: any) => p.per100km != null);
    const electricPoints = (data.electric?.dataPoints || []).filter((p: any) => p.per100km != null);
    const mk = (points: any[], label: string, color: string) => ({
      label,
      data: [...points]
        .sort((a: any, b: any) => a.recordTime.localeCompare(b.recordTime))
        .map((p: any) => ({ x: p.recordTime.slice(0, 10), y: p.per100km })),
      borderColor: color,
      backgroundColor: color,
      pointRadius: 3,
      tension: 0.3,
    });
    if (fuelPoints.length) datasets.push(mk(fuelPoints, '油耗', '#f59e0b'));
    if (electricPoints.length) datasets.push(mk(electricPoints, '电耗', '#10b981'));
    if (!datasets.length) return null;
    return { datasets };
  })();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { maxTicksLimit: 8, font: { size: 10 } } },
      y: { beginAtZero: false },
    },
  };

  return (
    <div>
      {/* Header: vehicle switcher + detail entry */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">能耗</h1>
        <div className="flex items-center gap-2">
          <VehicleSwitcher selectedVehicleId={vehicleId} onSelect={handleVehicleSelect} />
          <button
            onClick={() => navigate('/consumptions/list')}
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
          {/* Vehicle info */}
          {vehicle && (
            <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
              <p className="font-semibold">{vehicle.name}</p>
              <p className="text-sm text-gray-500">
                {typeLabels[vehicle.type] || vehicle.type} · 总里程 {vehicle.totalMileage.toFixed(0)} km · 总费用 ¥{vehicle.totalExpense.toFixed(2)}
              </p>
            </div>
          )}

          {/* Latest consumption */}
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <p className="text-sm text-gray-500">最近{unit.cons}</p>
            {loading ? (
              <p className="text-3xl font-bold text-gray-300">...</p>
            ) : latest ? (
              <p className="text-3xl font-bold">
                {latest.per100km.toFixed(2)} <span className="text-sm font-normal text-gray-500">{unit.per}</span>
              </p>
            ) : (
              <p className="text-3xl font-bold text-gray-300">--</p>
            )}
            {latest && (
              <p className="text-xs text-gray-400">{latest.recordTime.slice(0, 10)} · {latest.quantity}{unit.qty}</p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <p className="font-semibold mb-3">统计</p>
            {stats ? (
              <div className="grid grid-cols-3 gap-y-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">平均{unit.cons}</p>
                  <p className="font-bold">{stats.avgConsumption != null ? stats.avgConsumption.toFixed(2) : '-'}</p>
                  <p className="text-xs text-gray-400">{unit.per}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">平均行程</p>
                  <p className="font-bold">{stats.avgTrip.toFixed(1)}</p>
                  <p className="text-xs text-gray-400">公里/天</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">平均{unit.cost}</p>
                  <p className="font-bold">{stats.avgCostPerKm != null ? stats.avgCostPerKm.toFixed(2) : '-'}</p>
                  <p className="text-xs text-gray-400">元/公里</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">累计行程</p>
                  <p className="font-bold">{stats.totalDistance.toFixed(0)}</p>
                  <p className="text-xs text-gray-400">公里</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">累计{unit.cost}</p>
                  <p className="font-bold">{stats.totalCost.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">元</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">累计加{vehicleType === 'electric' ? '电' : '油'}</p>
                  <p className="font-bold">{stats.totalQuantity.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{unit.qty}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">暂无数据</p>
            )}
          </div>

          {/* Trend chart */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="font-semibold">
                {unit.cons}变化趋势 <span className="text-xs text-gray-400 font-normal">({vehicleType === 'electric' ? 'KWH/100KM' : 'L/100KM'})</span>
              </p>
              <div className="flex gap-1 flex-wrap">
                {RANGES.map((r) => (
                  <button key={r.key}
                    onClick={() => {
                      if (r.key === 'custom' && range !== 'custom') {
                        // 切到自定义时先保持当前查询，等用户选好日期点查询
                        if (!customStart || !customEnd) {
                          const now = new Date();
                          setCustomStart(`${now.getFullYear()}-01-01`);
                          setCustomEnd(now.toISOString().slice(0, 10));
                        }
                        setAutoFellBack(false);
                        return;
                      }
                      setAutoFellBack(false);
                      setRange(r.key);
                    }}
                    className={`px-2 py-1 rounded-full text-xs min-h-[32px] ${range === r.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {range === 'custom' && (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-sm min-h-[36px]" />
                <span className="text-sm text-gray-400">至</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="border rounded-lg px-2 py-1 text-sm min-h-[36px]" />
                <button
                  onClick={() => {
                    if (customStart && customEnd) {
                      setAppliedCustom({ start: customStart, end: customEnd });
                      setRange('custom');
                      setAutoFellBack(false);
                      load();
                    }
                  }}
                  disabled={!customStart || !customEnd}
                  className="bg-green-600 text-white rounded-lg px-3 py-1 text-sm min-h-[36px] disabled:opacity-50">
                  查询
                </button>
              </div>
            )}

            {autoFellBack && (
              <p className="text-xs text-amber-600 mb-2">所选时间范围内没有记录，已自动切换为全部</p>
            )}

            {chartData ? (
              <div className="h-64">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">当前时间范围内暂无能耗数据</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
