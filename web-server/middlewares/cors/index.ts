import cors, { CorsOptions } from "cors";
import { Request, Response, NextFunction } from "express";

const ensureOriginsMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  req.headers.origin = req.headers.origin || req.headers.host;
  next();
};

const corsOptions: CorsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  optionsSuccessStatus: 200,
  allowedHeaders: "Content-Type, Authorization",
};
const corsCheck = cors(corsOptions);

export { corsCheck, ensureOriginsMiddleware };
