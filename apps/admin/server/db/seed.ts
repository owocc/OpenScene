import { APP_TYPE_WEB } from "@openscene/constants";
import { type AppDatabase, initializeDatabase } from "./client.ts";
import { apps, appKeys, categories, locales, user } from "./schema/index.ts";
import { eq } from "drizzle-orm";
import { hashSecret, newId, newSecret, nowIso } from "./ids.ts";
import { auth } from "../../lib/auth.ts";

export async function seedDefaultData(db: AppDatabase): Promise<void> {
  // 1. Seed Demo App if not exists
  const existingApp = await db.select({ id: apps.id }).from(apps).where(eq(apps.key, "demo")).get();
  if (!existingApp) {
    const timestamp = nowIso();
    const appId = newId("app");
    const appKey = newSecret("appkey");
    const runtimeKey = newSecret("runtime");
    await db.transaction(async (tx) => {
      await tx
        .insert(apps)
        .values({
          id: appId,
          key: "demo",
          name: "OpenScene Demo",
          description: "Development seed App",
          status: "active",
          type: APP_TYPE_WEB,
          manifestMode: "push",
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      await tx
        .insert(appKeys)
        .values([
          {
            id: newId("key"),
            appId,
            kind: "app",
            keyHash: hashSecret(appKey),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: newId("key"),
            appId,
            kind: "runtime",
            keyHash: hashSecret(runtimeKey),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ])
        .run();
      await tx
        .insert(categories)
        .values({
          id: newId("category"),
          appId,
          scope: "shared",
          key: "default",
          name: "Default",
          isDefault: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
      await tx
        .insert(locales)
        .values({
          id: newId("locale"),
          appId,
          code: "en-US",
          name: "English (US)",
          isDefault: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    });
  }

  // 2. Seed Default Admin User from Environment Variables
  const defaultAdminEmail = process.env.OPENSCENE_DEFAULT_ADMIN_EMAIL || "admin@openscene.dev";
  const defaultAdminPassword = process.env.OPENSCENE_DEFAULT_ADMIN_PASSWORD || "Admin123456!";
  const defaultAdminName = process.env.OPENSCENE_DEFAULT_ADMIN_NAME || "Administrator";

  if (defaultAdminEmail && defaultAdminPassword) {
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, defaultAdminEmail))
      .get();

    if (!existingUser) {
      try {
        await auth.api.signUpEmail({
          body: {
            name: defaultAdminName,
            email: defaultAdminEmail,
            password: defaultAdminPassword,
          },
        });
        console.log(`[OpenScene] Default admin account created: ${defaultAdminEmail}`);
      } catch (err) {
        console.error("[OpenScene] Failed to create default admin account:", err);
      }
    }
  }
}

// Support direct CLI execution: bun server/db/seed.ts
if ((import.meta as unknown as { main?: boolean }).main) {
  const { db } = await initializeDatabase();
  await seedDefaultData(db);
}
