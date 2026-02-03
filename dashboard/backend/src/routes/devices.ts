import { Router, Request, Response } from "express";
import { goveeService } from "../services/govee.js";
import { GoveeApiError } from "../util/types.js";

const router = Router();

// Error handler wrapper
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      console.error("[API] Error:", error);
      if (error instanceof GoveeApiError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    });
  };
}

// GET /api/devices - List all devices with state
router.get("/", asyncHandler(async (_req, res) => {
  const devices = await goveeService.listDevicesWithState();
  res.json(devices);
}));

// GET /api/devices/:id - Get single device state
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { model } = req.query;

  if (!model || typeof model !== "string") {
    res.status(400).json({ error: "Model query parameter is required" });
    return;
  }

  const state = await goveeService.getState({ deviceId: id, model });
  res.json(state);
}));

// POST /api/devices/:id/power - Turn on/off
router.post("/:id/power", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { model, on } = req.body;

  if (!model || typeof model !== "string") {
    res.status(400).json({ error: "Model is required in body" });
    return;
  }

  if (typeof on !== "boolean") {
    res.status(400).json({ error: "'on' must be a boolean" });
    return;
  }

  await goveeService.setPower({ deviceId: id, model }, on);
  res.json({ success: true });
}));

// POST /api/devices/:id/brightness - Set brightness 0-100
router.post("/:id/brightness", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { model, percent } = req.body;

  if (!model || typeof model !== "string") {
    res.status(400).json({ error: "Model is required in body" });
    return;
  }

  if (typeof percent !== "number" || percent < 0 || percent > 100) {
    res.status(400).json({ error: "'percent' must be a number between 0 and 100" });
    return;
  }

  await goveeService.setBrightness({ deviceId: id, model }, percent);
  res.json({ success: true });
}));

// POST /api/devices/:id/color - Set RGB color
router.post("/:id/color", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { model, r, g, b } = req.body;

  if (!model || typeof model !== "string") {
    res.status(400).json({ error: "Model is required in body" });
    return;
  }

  if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
    res.status(400).json({ error: "'r', 'g', 'b' must be numbers" });
    return;
  }

  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    res.status(400).json({ error: "RGB values must be between 0 and 255" });
    return;
  }

  await goveeService.setColor({ deviceId: id, model }, { r, g, b });
  res.json({ success: true });
}));

// POST /api/devices/:id/color-temp - Set color temperature
router.post("/:id/color-temp", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { model, kelvin } = req.body;

  if (!model || typeof model !== "string") {
    res.status(400).json({ error: "Model is required in body" });
    return;
  }

  if (typeof kelvin !== "number" || kelvin < 2000 || kelvin > 9000) {
    res.status(400).json({ error: "'kelvin' must be a number between 2000 and 9000" });
    return;
  }

  await goveeService.setColorTemp({ deviceId: id, model }, kelvin);
  res.json({ success: true });
}));

export default router;
