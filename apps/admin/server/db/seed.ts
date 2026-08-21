import { initializeDatabase } from "./client";
import { apps, appKeys, categories, locales } from "./schema";
import { eq } from "drizzle-orm";
import { hashSecret, newId, newSecret, nowIso } from "./ids";

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
