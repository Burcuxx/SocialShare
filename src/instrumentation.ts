export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { workerStarted?: boolean };
  if (g.workerStarted) return;
  g.workerStarted = true;
  const { startWorker } = await import("./lib/worker");
  startWorker();
}
