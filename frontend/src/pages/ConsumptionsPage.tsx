import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useVehicles } from '../hooks/useVehicles';
import VehicleSwitcher from '../components/VehicleSwitcher';
import ConsumptionForm from '../components/ConsumptionForm';

const fuelTypeLabels: Record<string, string> = { gasoline: '汽油', diesel: '柴油', electric: '电' };

export default function ConsumptionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicleId, setVehicleId] = useState<string | null>(localStorage.getItem('selectedVehicleId'));
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const { vehicles } = useVehicles();

  const vehicleType = vehicles.find((v) => v.id === vehicleId)?.type;

  const handleVehicleSelect = (id: string) => {
    setVehicleId(id);
    localStorage.setItem('selectedVehicleId', id);
  };

  const loadData = useCallback(async (page = 1) => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const data = await api.getConsumptions(vehicleId, { page, pageSize: 20 });
      setConsumptions(data.consumptions);
      setPagination(data.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 从底部导航"+"进入时自动打开添加表单
  useEffect(() => {
    if (searchParams.get('add') === '1' && vehicleId) {
      setEditRecord(null);
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此能耗记录？')) return;
    try {
      await api.deleteConsumption(id);
      loadData();
    } catch (err: any) {
      alert(err.error || '删除失败');
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditRecord(null);
    loadData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">能耗详情</h1>
        <div className="flex items-center gap-2">
          <VehicleSwitcher selectedVehicleId={vehicleId} onSelect={handleVehicleSelect} />
          <button
            onClick={() => navigate('/consumptions')}
            className="border border-blue-600 text-blue-600 rounded-lg px-3 min-h-[44px] text-sm"
          >
            总览
          </button>
        </div>
      </div>

      {vehicleId && (
        <button
          onClick={() => { setEditRecord(null); setShowForm(true); }}
          className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4 min-h-[44px]"
        >
          + 添加能耗记录
        </button>
      )}

      {showForm && vehicleId && (
        <ConsumptionForm
          key={`${vehicleId}-${editRecord?.id || 'new'}`}
          vehicleId={vehicleId}
          vehicleType={vehicleType}
          record={editRecord}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditRecord(null); }}
        />
      )}

      {!vehicleId ? (
        <div className="text-center py-8 text-gray-400">请先选择车辆</div>
      ) : loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : consumptions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">暂无能耗记录</div>
      ) : (
        <div className="space-y-3">
          {consumptions.map((c) => (
            <div key={c.id} className="bg-white rounded-lg p-4 shadow-sm cursor-pointer" onClick={() => navigate(`/consumptions/records/${c.id}`)}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">
                    {fuelTypeLabels[c.fuelType] || c.fuelType} · {c.quantity.toFixed(2)}
                    {c.fuelType === 'electric' ? ' kWh' : ' L'}
                    {c.per100km != null && (
                      <span className="text-blue-600"> · {c.per100km.toFixed(1)}{c.fuelType === 'electric' ? ' kWh/100km' : ' L/100km'}</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {c.recordTime?.slice(0, 10)} · {c.mileage.toFixed(1)} km · ¥{((c.totalPrice || c.unitPrice * c.quantity)).toFixed(2)}
                  </p>
                  {c.fuelType === 'electric' && c.batteryBefore !== null && (
                    <p className="text-xs text-gray-400">
                      电量 {c.batteryBefore}% → {c.batteryAfter}%
                    </p>
                  )}
                  {c.fuelType === 'electric' && (c.vehicleDisplayedKwh != null || c.chargerDisplayedKwh != null) && (
                    <p className="text-xs text-gray-400">
                      车显 {c.vehicleDisplayedKwh != null ? c.vehicleDisplayedKwh.toFixed(2) : '—'} kWh ·
                      桩显 {c.chargerDisplayedKwh != null ? c.chargerDisplayedKwh.toFixed(2) : '—'} kWh
                    </p>
                  )}
                  {c.note && <p className="text-xs text-gray-400 whitespace-pre-line">{c.note}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500"
                    aria-label="删除"
                  >🗑️</button>
                </div>
              </div>
            </div>
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
                className="px-3 py-1 border rounded min-h-[44px] disabled:opacity-30"
              >上一页</button>
              <span className="py-1 px-2 text-sm text-gray-500">
                {pagination.page}/{pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1)}
                className="px-3 py-1 border rounded min-h-[44px] disabled:opacity-30"
              >下一页</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
