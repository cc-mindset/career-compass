import express, { Request, Response } from 'express';
import {
  createUserMarketReport,
  getLatestUserMarketReport,
  getUserMarketReportSnapshot,
  listUserMarketReports,
} from '../services/market-reports/userMarketReportService.js';

const marketReportsRouter = express.Router();

/** Create / replace latest; snapshots previous latest when present. */
marketReportsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, role, level, location, industry, insights, generatedAt } =
      req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!role || !level || !location) {
      return res
        .status(400)
        .json({ error: 'role, level, and location are required' });
    }
    if (!insights || typeof insights !== 'object') {
      return res.status(400).json({ error: 'insights object is required' });
    }

    const result = await createUserMarketReport({
      userId,
      role: String(role),
      level: String(level),
      location: String(location),
      industry: typeof industry === 'string' ? industry : '',
      insights,
      generatedAt,
    });

    return res.json({
      success: true,
      latest: result.latest,
      snapshottedPrevious: result.snapshottedPrevious,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error creating market report:', err);
    return res.status(500).json({
      error: 'Failed to save market report',
      message: err.message,
    });
  }
});

/** List latest summary + previous snapshots (no fabricated rows). */
marketReportsRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const list = await listUserMarketReports(userId);
    return res.json({
      success: true,
      latest: list.latest,
      snapshots: list.snapshots,
    });
  } catch (error) {
    console.error('Error listing market reports:', error);
    return res.status(500).json({ error: 'Failed to list market reports' });
  }
});

marketReportsRouter.get(
  '/:userId/latest',
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const latest = await getLatestUserMarketReport(userId);
      if (!latest) {
        return res.status(404).json({ error: 'No latest market report' });
      }
      return res.json({ success: true, report: latest });
    } catch (error) {
      console.error('Error fetching latest market report:', error);
      return res.status(500).json({ error: 'Failed to fetch latest report' });
    }
  },
);

marketReportsRouter.get(
  '/:userId/snapshots/:reportId',
  async (req: Request, res: Response) => {
    try {
      const { userId, reportId } = req.params;
      const snapshot = await getUserMarketReportSnapshot(userId, reportId);
      if (!snapshot) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }
      return res.json({ success: true, report: snapshot });
    } catch (error) {
      console.error('Error fetching market report snapshot:', error);
      return res.status(500).json({ error: 'Failed to fetch snapshot' });
    }
  },
);

export default marketReportsRouter;
