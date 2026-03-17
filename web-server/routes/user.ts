import express, { Request, Response } from "express";
import User from "../db/models/user";
const userRouter = express.Router();

// Save location endpoint
userRouter.post("/location", async (req: Request, res: Response) => {
  try {
    const { userId, location, city, lat, lng } = req.body;

    if (!userId || !location) {
      return res.status(400).json({ error: "Missing userId or location" });
    }

    // Update or create user in MongoDB
    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        $set: {
          location: {
            formatted: location,
            city: city || location,
            lat,
            lng,
          },
        },
      },
      { new: true, upsert: true },
    );

    console.log("✓ Location saved for:", userId);
    return res.json({ success: true, user });
  } catch (error) {
    console.error("Error saving location:", error);
    return res.status(500).json({ error: "Failed to save location" });
  }
});

// Get user endpoint
userRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    // Find user in MongoDB
    const user = await User.findOne({ clerkId: userId });

    if (user) {
      console.log("✓ Found user:", userId);
      return res.json(user);
    }

    // User not found - return empty structure
    return res.json({ clerkId: userId, location: null });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Create or update user (from Clerk webhook or frontend)
userRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { clerkId, email, firstName, lastName } = req.body;

    if (!clerkId || !email) {
      return res
        .status(400)
        .json({ error: "Missing required fields: clerkId and email" });
    }

    // Create or update user
    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        $set: {
          email,
          firstName,
          lastName,
        },
      },
      { new: true, upsert: true },
    );

    console.log("✓ User created/updated:", clerkId);
    return res.json({ success: true, user });
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return res.status(500).json({ error: "Failed to create/update user" });
  }
});

// Activate premium for user (developer mode)
userRouter.post(
  "/:userId/premium",
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const user = await User.findOneAndUpdate(
        { clerkId: userId },
        {
          isPremium: true,
          premiumActivatedAt: new Date(),
        },
        { new: true },
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ success: true, user });
    } catch (error) {
      console.error("Error activating premium:", error);
      return res.status(500).json({ error: "Failed to activate premium" });
    }
  },
);

// Update user profile
userRouter.patch(
  "/:userId/profile",
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const user = await User.findOneAndUpdate(
        { clerkId: userId },
        { $set: { profile: { ...updates } } },
        { new: true },
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({ success: true, user });
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  },
);

export default userRouter;
