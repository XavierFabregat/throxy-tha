import { WorkerManager } from "./worker-manager";

let workerManager: WorkerManager | null = null;

export async function initializeWorkers() {
  if (workerManager) {
    console.log("Workers already initialized");
    return;
  }

  workerManager = WorkerManager.getInstance();
  await workerManager.startWorkers();
}

export async function shutdownWorkers() {
  if (workerManager) {
    await workerManager.stopWorkers();
    workerManager = null;
  }
}
