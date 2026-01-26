import dotenv from 'dotenv';
// Load environment variables FIRST before any other imports
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateMarketInsights } from './services/marketInsightsService_multipart.js';
import { mongodbClient } from './lib/mongodb.js';
import User from './models/User.js';
import { parseResume } from './services/resumeParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX are allowed.'));
    }
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Connect to MongoDB on startup
await mongodbClient.connect();

// Save location endpoint
app.post('/api/users/location', async (req: Request, res: Response) => {
  try {
    const { userId, location, city, lat, lng } = req.body;

    if (!userId || !location) {
      return res.status(400).json({ error: 'Missing userId or location' });
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
      { new: true, upsert: true }
    );

    console.log('✓ Location saved for:', userId);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

// Get user endpoint
app.get('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    
    // Find user in MongoDB
    const user = await User.findOne({ clerkId: userId });

    if (user) {
      console.log('✓ Found user:', userId);
      return res.json(user);
    }

    // User not found - return empty structure
    res.json({ clerkId: userId, location: null });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create or update user (from Clerk webhook or frontend)
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { clerkId, email, firstName, lastName } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({ error: 'Missing required fields: clerkId and email' });
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
      { new: true, upsert: true }
    );

    console.log('✓ User created/updated:', clerkId);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Failed to create/update user' });
  }
});

// Return test resume text (for local/testing use)
app.get('/api/test-resume/:which', async (req: Request, res: Response) => {
  try {
    const which = req.params.which || 'data_scientist';
    const filePath = path.resolve(process.cwd(), `backend/tests/resume/${which}.txt`);

    const exists = fs.existsSync(filePath);
    if (!exists) return res.status(404).json({ error: 'Test resume not found' });

    const txt = await fs.promises.readFile(filePath, 'utf-8');
    res.json({ success: true, resumeText: txt });
  } catch (err) {
    console.error('Error reading test resume:', err);
    res.status(500).json({ error: 'Failed to read test resume' });
  }
});

// Generate market insights endpoint
app.post('/api/market-insights/generate', async (req: Request, res: Response) => {
  try {
    const { location, userId } = req.body;

    // Input validation
    if (!location || typeof location !== 'string') {
      return res.status(400).json({ error: 'Valid location string is required' });
    }

    // Sanitize location input (prevent injection attacks)
    const sanitizedLocation = location.trim().substring(0, 500);
    
    if (sanitizedLocation.length === 0) {
      return res.status(400).json({ error: 'Location cannot be empty' });
    }

    console.log(`📊 Generating market insights for ${sanitizedLocation}...`);

    const insights = await generateMarketInsights(sanitizedLocation, userId || '');
    
    // Validate insights structure before sending
    if (!insights || typeof insights !== 'object') {
      throw new Error('Invalid insights structure returned');
    }
    
    res.json({
      success: true,
      insights,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error in market insights endpoint:', err);
    
    // Don't expose internal errors to client
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to generate market insights. Please try again later.'
      : err.message;
    
    res.status(500).json({ 
      error: 'Failed to generate market insights',
      message: errorMessage 
    });
  }
});

// Activate premium for user (developer mode)
app.post('/api/users/:userId/premium', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { 
        isPremium: true,
        premiumActivatedAt: new Date()
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error activating premium:', error);
    res.status(500).json({ error: 'Failed to activate premium' });
  }
});

// Update user profile
app.patch('/api/users/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { $set: { profile: { ...updates } } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Resume upload endpoint
app.post('/api/resume/upload', upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📄 Parsing resume for user:', userId);
    console.log('File:', req.file.originalname, req.file.mimetype);

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
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✓ Resume parsed and profile updated for:', userId);

    res.json({
      success: true,
      profile: user.profile,
      resume: {
        fileName: user.resume?.fileName,
        uploadedAt: user.resume?.uploadedAt,
      },
    });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

const PORT = process.env.PORT || 5000;

app.get('/', (req: Request, res: Response) => {
  res.send('Ccmindset api is live 🎉');
});
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
