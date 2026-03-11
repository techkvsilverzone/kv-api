import sql from 'mssql';
import sqlWindows from 'mssql/msnodesqlv8';
import { config } from '../config';

let poolPromise: Promise<sql.ConnectionPool> | null = null;

const commonPool = {
  max: 10,
  min: 0,
  idleTimeoutMillis: 30000,
};

const getServerName = (): string => {
  if (config.sqlServerInstance) {
    return `${config.sqlServerHost}\\${config.sqlServerInstance}`;
  }

  return config.sqlServerHost;
};

const getWindowsConnectionString = (): string => {
  const trustCert = config.sqlServerTrustServerCertificate ? 'Yes' : 'No';
  return `Driver={ODBC Driver 17 for SQL Server};Server=${getServerName()};Database=${config.sqlServerDatabase};Trusted_Connection=Yes;TrustServerCertificate=${trustCert};`;
};

export const getSqlPool = async (): Promise<sql.ConnectionPool> => {
  if (!poolPromise) {
    if (config.sqlServerAuthType.toLowerCase() === 'windows') {
      const windowsConfig = {
        connectionString: getWindowsConnectionString(),
        options: {
          trustedConnection: true,
          trustServerCertificate: config.sqlServerTrustServerCertificate,
        },
        pool: commonPool,
      } as unknown as sqlWindows.config;

      poolPromise = new sqlWindows.ConnectionPool(windowsConfig).connect() as unknown as Promise<sql.ConnectionPool>;
    } else {
      const sqlConfig: sql.config = {
        user: config.sqlServerUser,
        password: config.sqlServerPassword,
        server: getServerName(),
        database: config.sqlServerDatabase,
        port: config.sqlServerPort,
        options: {
          encrypt: config.sqlServerEncrypt,
          trustServerCertificate: config.sqlServerTrustServerCertificate,
        },
        pool: commonPool,
      };

      poolPromise = new sql.ConnectionPool(sqlConfig).connect();
    }
  }

  return poolPromise;
};

export const closeSqlPool = async (): Promise<void> => {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
  }
};
