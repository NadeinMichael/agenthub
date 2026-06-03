import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1748500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
        "email"        character varying        NOT NULL,
        "passwordHash" character varying        NOT NULL,
        "name"         character varying        NOT NULL,
        "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users"      PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
