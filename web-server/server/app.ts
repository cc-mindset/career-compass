import express, { Request, Response } from "express";
import { corsCheck } from "../middlewares/cors";
import userRouter from "../routes/user";
import marketInsightRouter from "../routes/marketInsight";
import testResumeRouter from "../routes/testResume";
import resumeRouter from "../routes/resume";

const app = express();

app.use(corsCheck);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.send("Ccmindset api is live 🎉");
});
app.use("/api/users", userRouter);
app.use("/api/market-insights", marketInsightRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/test-resume", testResumeRouter);

export { app };
