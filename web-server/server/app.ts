import express, { Request, Response } from "express";
import { corsCheck } from "../middlewares/cors";
import userRouter from "../routes/user";
import marketInsightRouter from "../routes/marketInsight";
import marketReportsRouter from "../routes/marketReports";
import jobAnalyzerRouter from "../routes/jobAnalyzer";
import testResumeRouter from "../routes/testResume";
import resumeRouter from "../routes/resume";
import cronRouter from "../routes/cron";
import ecoSimulatorRouter from "../routes/ecoSimulator";

const app = express();

app.use(corsCheck);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.send("Ccmindset api is live 🎉");
});
app.use("/api/users", userRouter);
app.use("/api/market-insights", marketInsightRouter);
app.use("/api/market-reports", marketReportsRouter);
app.use("/api/job-analyzer", jobAnalyzerRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/test-resume", testResumeRouter);
app.use("/api/cron", cronRouter)
app.use("/api/eco-simulator", ecoSimulatorRouter);

export { app };
