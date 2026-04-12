import express, { Request, Response } from "express";
const cronRouter = express.Router();

cronRouter.get("/test", async (_req: Request, res: Response) => {
  try {

    return res.json({ success: true, message: "CRON TEST has started" });
  } catch (error) {
    console.error("Error saving location:", error);
    return res.status(500).json({ error: "Failed to save location" });
  }
});

export default cronRouter;
