import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import devicesRouter from "./routes/devices.js";

// Load .env from dashboard root or project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../../.env") });
config({ path: join(__dirname, "../../../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/devices", devicesRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Govee Dashboard Backend running on http://localhost:${PORT}`);
  console.log(`[Server] API endpoints:`);
  console.log(`  GET  /api/devices         - List all devices with state`);
  console.log(`  GET  /api/devices/:id     - Get device state`);
  console.log(`  POST /api/devices/:id/power       - Set power on/off`);
  console.log(`  POST /api/devices/:id/brightness  - Set brightness 0-100`);
  console.log(`  POST /api/devices/:id/color       - Set RGB color`);
  console.log(`  POST /api/devices/:id/color-temp  - Set color temperature`);

  if (!process.env.GOVEE_API_KEY) {
    console.warn(`[Server] WARNING: GOVEE_API_KEY not set!`);
  }

  if (process.env.GOVEE_DRY_RUN === "true") {
    console.log(`[Server] Running in DRY RUN mode - no commands will be sent to devices`);
  }
});
