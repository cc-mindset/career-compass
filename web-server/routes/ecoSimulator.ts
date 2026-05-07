import express, { Request, Response } from "express";
import { getEcoSimulatorData } from "../services/eco-simulator/ecoSimulatorService";


const ecoSimulatorRouter = express.Router();

ecoSimulatorRouter.get("/", async (req: Request, res: Response) => {
    try {
        const {
            location,
            current_job_title,
            seniority_level,
        } = req.query as { location: string, current_job_title: string, seniority_level: string };

        if (!location || !current_job_title || !seniority_level) {
            return res.status(400).json({ message: "Missing required query parameters: location, current_job_title, seniority_level" });
        }

        const ecoSimulatorData = await getEcoSimulatorData(location, current_job_title, seniority_level);
        return res.status(200).json({ data: ecoSimulatorData });
    } catch (error) {
        return res.status(500).json({ message: "Error creating eco-simulator entry", error });
    }
});

ecoSimulatorRouter.get("/cache-location-wise", async (req: Request, res: Response) => {
    try {
        const {
            locations,
            current_job_title,
            seniority_level,
        } = req.query as { locations: string, current_job_title: string, seniority_level: string };

        const locationsArray = locations.split(";");

        if (!locationsArray || !current_job_title || !seniority_level) {
            return res.status(400).json({ message: "Missing required query parameters: location, current_job_title, seniority_level" });
        }
        const ecoSimulatorDataPromises = [];
        for (const location of locationsArray) {
            await getEcoSimulatorData(location, current_job_title, seniority_level);
            ecoSimulatorDataPromises.push(location);
        }
        const ecoSimulatorData = await Promise.all(ecoSimulatorDataPromises);
        return res.status(200).json({ data: ecoSimulatorData });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Error creating eco-simulator entry", error });
    }
});

export default ecoSimulatorRouter;