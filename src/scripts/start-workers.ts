import { initializeWorkers } from "@/lib/queue/init";
import { config } from "dotenv";

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
config();

async function main() {
  console.log("🚀 Starting BullMQ workers...");

  await initializeWorkers();

  // Keep the process running
  process.on("SIGINT", () => {
    console.log("Received SIGINT, shutting down gracefully...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    process.exit(0);
  });
}

main().catch(console.error);
