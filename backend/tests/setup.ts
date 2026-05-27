import { resetEnvCache } from "../src/config.js";
import { initDataStore, resetDataStore } from "../src/data/index.js";

process.env.NODE_ENV = "test";
process.env.USE_MEMORY_STORE = "true";
process.env.OPENROUTER_API_KEY = "";

resetEnvCache();
resetDataStore();
initDataStore();
