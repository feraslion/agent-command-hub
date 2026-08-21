import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { isAllowedCorsOrigin } from "./cors";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { startDryWorker } from "../dry-worker";
import { registerLocalRunnerRoutes } from "../local-runner-routes";
import { registerRuntimeRealtime } from "../runtime-realtime";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  registerRuntimeRealtime(server);

  // Allow credentialed CORS only from explicitly configured application origins.
  // Requests without Origin (Runner, health checks, same-origin calls) still reach their route.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigin = isAllowedCorsOrigin(origin);
    if (origin && allowedOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      if (origin && !allowedOrigin) {
        res.status(403).json({ error: "CORS origin is not allowed" });
        return;
      }
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerLocalRunnerRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    const stopDryWorker = startDryWorker();
    server.once("close", stopDryWorker);
  });
}

startServer().catch(console.error);
