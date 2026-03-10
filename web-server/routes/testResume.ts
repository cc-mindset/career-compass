import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";

const testResumeRouter = express.Router();

// Return test resume text (for local/testing use)
testResumeRouter.get(
  "/:which",
  async (req: Request, res: Response) => {
    try {
      const which = req.params.which || "data_scientist";
      const filePath = path.resolve(
        process.cwd(),
        `backend/tests/resume/${which}.txt`,
      );

      const exists = fs.existsSync(filePath);
      if (!exists)
        return res.status(404).json({ error: "Test resume not found" });

      const txt = await fs.promises.readFile(filePath, "utf-8");
      return res.json({ success: true, resumeText: txt });
    } catch (err) {
      console.error("Error reading test resume:", err);
      return res.status(500).json({ error: "Failed to read test resume" });
    }
  },
);

export default testResumeRouter;
