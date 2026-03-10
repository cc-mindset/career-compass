import express, { Request, Response } from "express";
import multer from "multer";
import User from "../models/user";
import { parseResume } from "../services/resumeParser";

const resumeRouter = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    console.log("Request:", req);
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and DOCX are allowed."));
    }
  },
});

// Resume upload endpoint
resumeRouter.post(
  "/upload",
  upload.single("resume"),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log("📄 Parsing resume for user:", userId);
      console.log("File:", req.file.originalname, req.file.mimetype);

      // Parse the resume
      const parseResult = await parseResume(req.file.buffer, req.file.mimetype);

      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error });
      }

      // Update user profile with parsed data
      const user = await User.findOneAndUpdate(
        { clerkId: userId },
        {
          profile: parseResult.data,
          resume: {
            fileName: req.file.originalname,
            uploadedAt: new Date(),
            content: parseResult.rawText,
          },
        },
        { new: true },
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("✓ Resume parsed and profile updated for:", userId);

      return res.json({
        success: true,
        profile: user.profile,
        resume: {
          fileName: user.resume?.fileName,
          uploadedAt: user.resume?.uploadedAt,
        },
      });
    } catch (error) {
      console.error("Error uploading resume:", error);
      return res.status(500).json({ error: "Failed to upload resume" });
    }
  },
);

export default resumeRouter;
