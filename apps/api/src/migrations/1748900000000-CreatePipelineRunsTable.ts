import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePipelineRunsTable1748900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE pipeline_run_status_enum AS ENUM ('running', 'completed', 'failed')`,
    );

    await queryRunner.query(`
      CREATE TABLE pipeline_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task TEXT NOT NULL,
        status pipeline_run_status_enum NOT NULL DEFAULT 'running',
        "agentResults" JSONB,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `ALTER TABLE agent_runs ALTER COLUMN "agentId" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE agent_runs
         ADD COLUMN IF NOT EXISTS "pipelineRunId" UUID
           REFERENCES pipeline_runs(id) ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS "agentRole" TEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agent_runs DROP COLUMN IF EXISTS "agentRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE agent_runs DROP COLUMN IF EXISTS "pipelineRunId"`,
    );
    await queryRunner.query(
      `ALTER TABLE agent_runs ALTER COLUMN "agentId" SET NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS pipeline_runs`);
    await queryRunner.query(`DROP TYPE IF EXISTS pipeline_run_status_enum`);
  }
}
