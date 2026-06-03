import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentRunsTable1748700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "agent_runs_status_enum" AS ENUM ('pending', 'running', 'completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_runs" (
        "id"        uuid                           NOT NULL DEFAULT gen_random_uuid(),
        "agentId"   uuid                           NOT NULL,
        "task"      text                           NOT NULL,
        "result"    text,
        "status"    "agent_runs_status_enum"       NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP WITH TIME ZONE       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_runs"     PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_runs_agentId"
          FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_runs_agentId"
        ON "agent_runs" ("agentId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_runs_status"
        ON "agent_runs" ("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_runs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "agent_runs_status_enum"`);
  }
}
