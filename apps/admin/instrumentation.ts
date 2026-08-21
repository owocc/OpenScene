export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeDatabase } = await import("./server/db/client");
    await initializeDatabase();
  }
}
