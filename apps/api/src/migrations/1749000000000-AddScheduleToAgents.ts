import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleToAgents1749000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agents ADD COLUMN IF NOT EXISTS schedule TEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE agents DROP COLUMN IF EXISTS schedule`,
    );
  }
}
