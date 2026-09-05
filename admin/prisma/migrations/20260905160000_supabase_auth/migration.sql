ALTER TABLE "public"."User" ADD COLUMN "supabaseAuthId" TEXT;

CREATE UNIQUE INDEX "User_supabaseAuthId_key" ON "public"."User"("supabaseAuthId");
