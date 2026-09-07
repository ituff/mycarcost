import { localDb } from '../db/localDb';
import type { SyncStatus } from '@mycarcost/shared';
import type { SyncQueueItem } from '@mycarcost/shared';

/**
 * 同步引擎：把本地 syncQueue 中的操作批量发送到 POST /api/sync。
 * - 网络恢复后 30 秒内自动开始同步
 * - 失败 60 秒后重试，最多 3 次（服务端做 LWW 与冲突存档）
 * - 通过 onStatus 回调向 UI 暴露同步状态
 *
 * 当前页面为在线直连模式，本引擎供离线模式接线后使用。
 */

const SYNC_TRIGGER_DELAY_MS = 30_000;
const SYNC_RETRY_DELAY_MS = 60_000;
const SYNC_MAX_RETRIES = 3;
const BATCH_SIZE = 50;

export class SyncEngine {
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private status: SyncStatus = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncTime: null,
    syncState: 'idle',
    retryCount: 0,
  };

  constructor(private onStatus?: (status: SyncStatus) => void) {}

  start() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.refreshPendingCount();
    if (navigator.onLine) {
      this.scheduleSync();
    }
  }

  stop() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  /** 入队一个本地操作（create/update/delete） */
  async enqueue(op: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>) {
    await localDb.syncQueue.add({
      ...op,
      createdAt: new Date().toISOString(),
      retries: 0,
    });
    this.refreshPendingCount();
    if (navigator.onLine) {
      this.scheduleSync();
    }
  }

  /** 手动触发一次同步（在线时） */
  async syncNow(): Promise<boolean> {
    return this.runSync();
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  private handleOnline = () => {
    this.status.isOnline = true;
    this.emit();
    // 网络恢复后 30 秒内自动开始同步
    this.scheduleSync();
  };

  private handleOffline = () => {
    this.status.isOnline = false;
    this.emit();
  };

  private scheduleSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.runSync();
    }, SYNC_TRIGGER_DELAY_MS);
  }

  private scheduleRetry() {
    if (this.status.retryCount >= SYNC_MAX_RETRIES) {
      this.status.syncState = 'error';
      this.emit();
      return;
    }
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.status.retryCount += 1;
      this.runSync();
    }, SYNC_RETRY_DELAY_MS);
  }

  private async runSync(): Promise<boolean> {
    if (this.syncing || !navigator.onLine) return false;

    const pending = await localDb.syncQueue.orderBy('id').toArray();
    if (pending.length === 0) {
      this.status.pendingCount = 0;
      this.status.syncState = 'idle';
      this.emit();
      return true;
    }

    this.syncing = true;
    this.status.syncState = 'syncing';
    this.emit();

    let allOk = true;
    try {
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        const ok = await this.syncBatch(batch);
        if (!ok) allOk = false;
      }

      if (allOk) {
        this.status.lastSyncTime = new Date().toISOString();
        this.status.syncState = 'idle';
        this.status.retryCount = 0;
      } else {
        this.scheduleRetry();
      }
    } catch {
      allOk = false;
      this.scheduleRetry();
    } finally {
      this.syncing = false;
      await this.refreshPendingCount();
      this.emit();
    }

    return allOk;
  }

  private async syncBatch(batch: SyncQueueItem[]): Promise<boolean> {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: batch.map(({ tableName, operation, recordId, record }) => ({
            tableName,
            operation,
            recordId,
            record,
          })),
        }),
      });
      if (!res.ok) return false;

      const body = await res.json();
      const failed = new Set<string>();
      for (const r of body.results || []) {
        if (r.status === 'error') failed.add(r.recordId);
      }

      // 删除已成功/冲突的队列项（冲突已在服务端存档）
      const doneIds = batch
        .filter((b) => !failed.has(b.recordId))
        .map((b) => b.id!)
        .filter(Boolean);
      if (doneIds.length) {
        await localDb.syncQueue.bulkDelete(doneIds);
      }
      return failed.size === 0;
    } catch {
      return false;
    }
  }

  private async refreshPendingCount() {
    try {
      this.status.pendingCount = await localDb.syncQueue.count();
    } catch {
      this.status.pendingCount = 0;
    }
    this.emit();
  }

  private emit() {
    this.onStatus?.({ ...this.status });
  }
}

// 单例：应用启动后由 main/需要离线能力的模块调用 start()
export const syncEngine = new SyncEngine();
