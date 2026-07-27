import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_groups_visibility" AS ENUM('unlisted', 'private');
  CREATE TABLE "groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"owner_id" integer NOT NULL,
  	"invite_code" varchar NOT NULL,
  	"visibility" "enum_groups_visibility" DEFAULT 'unlisted',
  	"avatar_emoji" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "groups_id" integer;
  ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "groups_rels" ADD CONSTRAINT "groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "groups_rels" ADD CONSTRAINT "groups_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "groups_slug_idx" ON "groups" USING btree ("slug");
  CREATE INDEX "groups_owner_idx" ON "groups" USING btree ("owner_id");
  CREATE UNIQUE INDEX "groups_invite_code_idx" ON "groups" USING btree ("invite_code");
  CREATE INDEX "groups_updated_at_idx" ON "groups" USING btree ("updated_at");
  CREATE INDEX "groups_created_at_idx" ON "groups" USING btree ("created_at");
  CREATE INDEX "groups_rels_order_idx" ON "groups_rels" USING btree ("order");
  CREATE INDEX "groups_rels_parent_idx" ON "groups_rels" USING btree ("parent_id");
  CREATE INDEX "groups_rels_path_idx" ON "groups_rels" USING btree ("path");
  CREATE INDEX "groups_rels_users_id_idx" ON "groups_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_groups_fk" FOREIGN KEY ("groups_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("groups_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "groups_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "groups" CASCADE;
  DROP TABLE "groups_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_groups_fk";
  
  DROP INDEX "payload_locked_documents_rels_groups_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "groups_id";
  DROP TYPE "public"."enum_groups_visibility";`)
}
