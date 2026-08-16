import { Request, Response } from 'express';
import { pingPostgres } from '../infrastructure/postgres/pool';

export class HealthController {
  /**
   * Liveness + database reachability.
   *
   * The response contract is unchanged (`status` + `timestamp`); what changed is
   * that `status` now reflects a real `SELECT 1` against PostgreSQL rather than
   * being unconditionally 'UP'. A failing database answers 503 so a load
   * balancer takes the instance out of rotation instead of routing traffic to
   * a process that can only return 500s.
   */
  public getHealth = async (req: Request, res: Response): Promise<void> => {
    const databaseUp = await pingPostgres();

    res.status(databaseUp ? 200 : 503).json({
      status: databaseUp ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
    });
  };
}
