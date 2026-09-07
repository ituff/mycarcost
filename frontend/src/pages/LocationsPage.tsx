import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLocation, setEditLocation] = useState<any>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const data = q ? await api.searchLocations(q) : await api.getLocations();
      setLocations(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openForm = (location?: any) => {
    setEditLocation(location || null);
    setName(location?.name || '');
    setAddress(location?.address || '');
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (editLocation) {
        await api.updateLocation(editLocation.id, { name: name.trim(), address: address.trim() || undefined });
      } else {
        await api.createLocation({ name: name.trim(), address: address.trim() || undefined });
      }
      setShowForm(false);
      load(searchKeyword || undefined);
    } catch (err: any) {
      setError(err?.fields?.name || err?.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (location: any) => {
    if (!confirm(`确定删除地点"${location.name}"？能耗记录中的引用将被清空。`)) return;
    try {
      await api.deleteLocation(location.id);
      load(searchKeyword || undefined);
    } catch (err: any) {
      alert(err?.error || '删除失败');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(searchKeyword.trim() || undefined);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">地点管理</h1>
        <button
          onClick={() => openForm()}
          className="bg-blue-600 text-white rounded-lg px-4 min-h-[44px] text-sm"
        >
          + 添加地点
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 min-h-[44px]"
          placeholder="按名称或地址搜索"
        />
        <button type="submit" className="border border-blue-600 text-blue-600 rounded-lg px-4 min-h-[44px] text-sm">
          搜索
        </button>
      </form>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
          <div>
            <label htmlFor="lf-name" className="block text-sm text-gray-600 mb-1">地点名称（1-50 字符）</label>
            <input
              id="lf-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
              placeholder="如 中国石化鸿达加油站"
              required
            />
          </div>
          <div>
            <label htmlFor="lf-address" className="block text-sm text-gray-600 mb-1">地址（选填，≤200 字符）</label>
            <input
              id="lf-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            />
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
      ) : locations.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{searchKeyword ? '没有匹配的地点' : '暂无地点'}</div>
      ) : (
        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center">
              <div>
                <p className="font-medium">{loc.name}</p>
                {loc.address && <p className="text-xs text-gray-400">{loc.address}</p>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openForm(loc)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600"
                  aria-label="编辑"
                >✏️</button>
                <button
                  onClick={() => handleDelete(loc)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500"
                  aria-label="删除"
                >🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
