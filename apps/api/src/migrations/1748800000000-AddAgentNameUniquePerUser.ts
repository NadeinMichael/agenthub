import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentNameUniquePerUser1748800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Remove duplicate agents — keep the most recently created one per (userId, name)
    await queryRunner.query(`
      DELETE FROM "agents"
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY "userId", name
                   ORDER BY "createdAt" DESC
                 ) AS rn
          FROM "agents"
        ) ranked
        WHERE rn > 1
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "agents"
          ADD CONSTRAINT "UQ_agents_userId_name" UNIQUE ("userId", "name");
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "UQ_agents_userId_name"
    `);
  }
}
