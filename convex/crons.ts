import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("expire stuck automation events", { minutes: 15 }, internal.automation.expireStuck, {});

export default crons;
