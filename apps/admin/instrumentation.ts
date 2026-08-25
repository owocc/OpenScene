export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeDatabase } = await import("./server/db/client");
    const { db } = await initializeDatabase();
    const { seedDefaultData } = await import("./server/db/seed");
    await seedDefaultData(db);
  }
}
