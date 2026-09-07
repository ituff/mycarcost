import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useVehicles } from '../hooks/useVehicles';

const typeLabels: Record<string, string> = { fuel: '燃油车', electric: '纯电车', hybrid: '插电混动' };

export default function VehiclesPage() {
  const navigate = useNavigate();
  const { vehicles, loading, refresh } = useVehicles();
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<any>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('fuel');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openForm = (vehicle?: any) => {
    setEditVehicle(vehicle || null);
    setName(vehicle?.name || '');
    setType(vehicle?.type || 'fuel');
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (editVehicle) {
        const result = await api.updateVehicle(editVehicle.id, { name: name.trim(), type });
        const incompatible = result?.incompatibleCount || 0;
        setShowForm(false);
        if (incompatible > 0) {
          if (confirm(`车辆类型已修改。有 ${incompatible} 条与新车类型不兼容的能耗记录，是否立即删除这些记录？`)) {
            alert('请手动删除列表中标记的记录'); // 记录仍保留，由用户在记录页处理
          }
        }
        refresh();
      } else {
        await api.createVehicle({ name: name.trim(), type });
        setShowForm(false);
        refresh();
      }
    } catch (err: any) {
      setError(err?.fields?.name || err?.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTypeOnly = async (vehicle: any, newType: string) => {
    if (newType === vehicle.type) return;
    if (!confirm('修改车辆类型可能与已有能耗记录不兼容，不兼容的记录将无法继续编辑，确定修改？')) return;
    try {
      await api.updateVehicle(vehicle.id, { name: vehicle.name, type: newType });
      refresh();
    } catch (err: any) {
      alert(err?.error || '修改失败');
    }
  };

  const handleDelete = async (vehicle: any) => {
    const hasData = (vehicle.totalMileage || 0) > 0 || (vehicle.totalExpense || 0) > 0;
    const msg = hasData
      ? `确定删除车辆"${vehicle.name}"？其关联的能耗和费用记录将一并删除。`
      : `确定删除车辆"${vehicle.name}"？`;
    if (!confirm(msg)) return;
    try {
      await api.deleteVehicle(vehicle.id);
      const remaining = localStorage.getItem('selectedVehicleId');
      if (remaining === vehicle.id) localStorage.removeItem('selectedVehicleId');
      refresh();
    } catch (err: any) {
      alert(err?.error || '删除失败');
    }
  };

  const selectVehicle = (id: string) => {
    localStorage.setItem('selectedVehicleId', id);
    navigate('/consumptions');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">我的车辆</h1>
        <button
          onClick={() => openForm()}
          className="bg-blue-600 text-white rounded-lg px-4 min-h-[44px] text-sm"
        >
          + 添加车辆
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
          <div>
            <label htmlFor="vf-name" className="block text-sm text-gray-600 mb-1">车辆名称（1-30 字符）</label>
            <input
              id="vf-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
              placeholder="如 高尔夫7"
              required
            />
          </div>
          <div>
            <label htmlFor="vf-type" className="block text-sm text-gray-600 mb-1">车辆类型</label>
            <select
              id="vf-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            >
              <option value="fuel">燃油车</option>
              <option value="electric">纯电车</option>
              <option value="hybrid">插电混动</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">
              {submitting ? '保存中...' : '保存'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-8 text-gray-400">还没有车辆，点击右上角添加</div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div key={v.id} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="cursor-pointer" onClick={() => selectVehicle(v.id)}>
                  <p className="font-semibold">{v.name} <span className="text-xs text-gray-400">{typeLabels[v.type] || v.type}</span></p>
                  <p className="text-sm text-gray-500">
                    总里程 {Number(v.totalMileage || 0).toFixed(0)} km · 总费用 ¥{Number(v.totalExpense || 0).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openForm(v)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600"
                    aria-label="编辑"
                  >✏️</button>
                  <button
                    onClick={() => handleDelete(v)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500"
                    aria-label="删除"
                  >🗑️</button>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-3">
                <select
                  value={v.type}
                  onChange={(e) => handleEditTypeOnly(v, e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                  aria-label="切换车辆类型"
                >
                  <option value="fuel">燃油车</option>
                  <option value="electric">纯电车</option>
                  <option value="hybrid">插电混动</option>
                </select>
                <Link to="/consumptions" className="text-xs text-blue-600 min-h-[44px] flex items-center" onClick={() => selectVehicle(v.id)}>
                  记能耗 →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
