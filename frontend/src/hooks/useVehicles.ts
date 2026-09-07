import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export function useVehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getVehicles();
      setVehicles(data.vehicles);
      setError(null);
    } catch (e: any) {
      setError(e.error || '获取车辆列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { vehicles, loading, error, refresh };
}
