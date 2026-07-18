import { Pool, PoolClient } from 'pg';
export declare function getPool(): Pool;
export declare function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
//# sourceMappingURL=pool.d.ts.map