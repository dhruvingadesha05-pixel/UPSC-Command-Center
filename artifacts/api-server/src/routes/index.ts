import { Router, type IRouter } from "express";
import { requireOwner, requireSameOrigin } from "../middlewares/requireOwner";
import healthRouter from "./health";
import calendarRouter from "./calendar";
import dashboardRouter from "./dashboard";
import fitnessRouter from "./fitness";
import habitsRouter from "./habits";
import notionRouter from "./notion";
import settingsRouter from "./settings";
import studyRouter from "./study";
import subjectsRouter from "./subjects";
import wellnessRouter from "./wellness";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireOwner, requireSameOrigin);
router.use(dashboardRouter);
router.use(studyRouter);
router.use(wellnessRouter);
router.use(fitnessRouter);
router.use(habitsRouter);
router.use(subjectsRouter);
router.use(settingsRouter);
router.use(notionRouter);
router.use(calendarRouter);

export default router;
