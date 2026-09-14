import express, {
  Router,
  type Application,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";

const app: Application = express();

app.use(
  cors({
    origin: config.frontendUrl || "*",
    credentials: true,
  }),
);
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Courier & Logistics Management Platform API is running.",
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "OK",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", Router);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
