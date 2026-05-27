import { getEnv } from "../config.js";
import { memoryStore } from "./memory-store.js";
import { postgresStore } from "./postgres-store.js";
import type { DataStore } from "./types.js";

let store: DataStore | null = null;

export function initDataStore(): DataStore {
  const env = getEnv();
  store = env.USE_MEMORY_STORE ? memoryStore : postgresStore;
  return store;
}

export function getStore(): DataStore {
  if (!store) {
    return initDataStore();
  }
  return store;
}

export function resetDataStore(): void {
  store = null;
}
