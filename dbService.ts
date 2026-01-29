
import { User, ActivityLog, Task, RamadanEntry, PastPaperEntry } from './types';

const DB_NAME = 'ZyphraCloudTrackerDB';
const DB_VERSION = 2; // Incremented version to add past_papers store

export class DBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'uid' });
        }
        if (!db.objectStoreNames.contains('logs')) {
          db.createObjectStore('logs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('planner')) {
          db.createObjectStore('planner', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ramadan')) {
          db.createObjectStore('ramadan', { keyPath: ['uid', 'date'] });
        }
        if (!db.objectStoreNames.contains('past_papers')) {
          db.createObjectStore('past_papers', { keyPath: 'id' });
        }
      };
    });
  }

  async saveUser(user: User): Promise<void> {
    return this.put('users', user);
  }

  async getUser(email: string): Promise<User | null> {
    const users = await this.getAll<User>('users');
    return users.find(u => u.email === email) || null;
  }

  async addLog(log: ActivityLog): Promise<void> {
    return this.put('logs', log);
  }

  async getLogs(uid: string): Promise<ActivityLog[]> {
    const all = await this.getAll<ActivityLog>('logs');
    return all.filter(l => l.uid === uid).sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteLog(id: string): Promise<void> {
    return this.delete('logs', id);
  }

  async saveTask(task: Task): Promise<void> {
    return this.put('planner', task);
  }

  async getTasks(uid: string, date: string): Promise<Task[]> {
    const all = await this.getAll<Task>('planner');
    return all.filter(t => t.uid === uid && t.date === date);
  }

  async deleteTask(id: string): Promise<void> {
    return this.delete('planner', id);
  }

  async saveRamadan(entry: RamadanEntry): Promise<void> {
    return this.put('ramadan', entry);
  }

  async getRamadan(uid: string, date: string): Promise<RamadanEntry | null> {
    const all = await this.getAll<RamadanEntry>('ramadan');
    return all.find(e => e.uid === uid && e.date === date) || null;
  }

  async savePastPaper(entry: PastPaperEntry): Promise<void> {
    return this.put('past_papers', entry);
  }

  async getPastPapers(uid: string): Promise<PastPaperEntry[]> {
    const all = await this.getAll<PastPaperEntry>('past_papers');
    return all.filter(p => p.uid === uid);
  }

  // Generic helpers
  private async put(storeName: string, data: any): Promise<void> {
    const tx = this.db!.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    return new Promise((r) => tx.oncomplete = () => r());
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const tx = this.db!.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    return new Promise((r) => request.onsuccess = () => r(request.result));
  }

  private async delete(storeName: string, key: any): Promise<void> {
    const tx = this.db!.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    return new Promise((r) => tx.oncomplete = () => r());
  }
}

export const db = new DBService();
