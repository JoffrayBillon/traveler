import { waitUntil } from "@vercel/functions";
import type { BackgroundTaskScheduler } from "../../ports/background-task-scheduler";

export const scheduleVercelBackgroundTask: BackgroundTaskScheduler = (task) => {
  waitUntil(task);
};
