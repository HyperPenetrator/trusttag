"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.withClient = withClient;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// ─────────────────────────────────────────────────────────────────────────────
// Connection pool — reused across all requests
// ─────────────────────────────────────────────────────────────────────────────
let pool = null;
function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        pool = new pg_1.Pool({ connectionString, max: 10 });
        pool.on('error', (err) => {
            console.error('[pg] Unexpected pool error:', err.message);
        });
    }
    return pool;
}
async function withClient(fn) {
    const client = await getPool().connect();
    try {
        return await fn(client);
    }
    finally {
        client.release();
    }
}
