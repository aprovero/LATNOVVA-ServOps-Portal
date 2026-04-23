import { get, set, del } from 'idb-keyval';
import { StateStorage } from 'zustand/middleware';

// Custom storage object that implements the StateStorage interface for Zustand
export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    console.log('[IDBStorage] Getting item:', name);
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    console.log('[IDBStorage] Setting item:', name);
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    console.log('[IDBStorage] Removing item:', name);
    await del(name);
  },
};
