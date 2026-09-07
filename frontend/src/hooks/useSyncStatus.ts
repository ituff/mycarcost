import { useState, useEffect } from 'react';
import { syncEngine } from '../sync/syncEngine';
import type { SyncStatus } from '@mycarcost/shared';
import { localDb } from '../db/localDb';

/**
 * 订阅同步引擎状态 + 待同步条数（离线指示器使用）。
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());

  useEffect(() => {
    // 引擎状态变化时更新
    const base: SyncStatus = { ...syncEngine.getStatus() };
    setStatus(base);

    // 轮询待同步条数（低频，兼顾无引擎回调的场景）
    const timer = setInterval(async () => {
      try {
        const pendingCount = await localDb.syncQueue.count();
        setStatus((prev) => ({ ...prev, pendingCount }));
      } catch { /* ignore */ }
    }, 5000);

    const onOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }));
    const onOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return status;
}
