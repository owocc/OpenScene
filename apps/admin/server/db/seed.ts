import { APP_TYPE_WEB } from "@openscene/constants";
import { initializeDatabase } from "./client";
import { apps, appKeys, categories, locales } from "./schema";
import { eq } from "drizzle-orm";
import { hashSecret, newId, newSecret, nowIso } from "./ids";

import { auth } from "../../lib/auth";
import { user } from "./schema";
const { db } = await initializeDatabase();
const existing = await db.select({ id: apps.id }).from(apps).where(eq(apps.key, "demo")).get();
if (!existing) {
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
        code: "en",
        name: "English",
        isDefault: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  });
  console.log(JSON.stringify({ appId, appKey, runtimeKey }));
} else {
  console.log("OpenScene demo App already exists");
}

const defaultAdminEmail = process.env.OPENSCENE_DEFAULT_ADMIN_EMAIL || "admin@openscene.dev";
const defaultAdminPassword = process.env.OPENSCENE_DEFAULT_ADMIN_PASSWORD || "Admin123456!";
const defaultAdminName = process.env.OPENSCENE_DEFAULT_ADMIN_NAME || "Administrator";

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
    console.log(
      `Created default admin account: ${defaultAdminEmail} (password: ${defaultAdminPassword})`,
    );
  } catch (err) {
    console.error("Failed to create default admin account:", err);
  }
} else {
  console.log(`Default admin account (${defaultAdminEmail}) already exists`);
}
