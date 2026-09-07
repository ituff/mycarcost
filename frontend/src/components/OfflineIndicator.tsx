import { useSyncStatus } from '../hooks/useSyncStatus';

export default function OfflineIndicator() {
  const { isOnline, pendingCount } = useSyncStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`text-center text-sm py-2 ${
        isOnline ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {isOnline
        ? `正在同步 ${pendingCount} 条待同步记录...`
        : `当前离线${pendingCount > 0 ? `，${pendingCount} 条记录待同步` : ''}，数据将保存在本地`}
    </div>
  );
}
