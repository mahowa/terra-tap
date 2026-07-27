import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('player', 'admin');
  CREATE TYPE "public"."enum_results_mode" AS ENUM('daily', 'speed', 'versus', 'history', 'quiz');
  CREATE TABLE "results" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"mode" "enum_results_mode" NOT NULL,
  	"date_key" varchar,
  	"title" varchar,
  	"total" numeric NOT NULL,
  	"max_possible" numeric,
  	"rounds" jsonb,
  	"elapsed_ms" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'player' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "results_id" integer;
  ALTER TABLE "results" ADD CONSTRAINT "results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "results_user_idx" ON "results" USING btree ("user_id");
  CREATE INDEX "results_mode_idx" ON "results" USING btree ("mode");
  CREATE INDEX "results_date_key_idx" ON "results" USING btree ("date_key");
  CREATE INDEX "results_updated_at_idx" ON "results" USING btree ("updated_at");
  CREATE INDEX "results_created_at_idx" ON "results" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_results_fk" FOREIGN KEY ("results_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_results_id_idx" ON "payload_locked_documents_rels" USING btree ("results_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "results" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "results" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_results_fk";
  
  DROP INDEX "payload_locked_documents_rels_results_id_idx";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "results_id";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_results_mode";`)
}
