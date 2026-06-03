import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentsTable1748600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "agents_status_enum" AS ENUM ('active', 'inactive', 'error');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agents" (
        "id"          uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "name"        character varying         NOT NULL,
        "description" text,
        "status"      "agents_status_enum"      NOT NULL DEFAULT 'inactive',
        "config"      jsonb,
        "userId"      uuid                      NOT NULL,
        "createdAt"   TIMESTAMP WITH TIME ZONE  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agents_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agents_userId" ON "agents" ("userId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agents"`);
    await queryRunner.query(`DROP TYPE "agents_status_enum"`);
  }
}
