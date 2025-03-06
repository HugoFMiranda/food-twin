import { createCallerFactory, createTRPCRouter } from "food-twin/server/api/trpc";
import { foodRouter } from "./routers/foodRouter";

// Primary router for the server
export const appRouter = createTRPCRouter({
  food: foodRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;

// Create a server-side caller for the tRPC API
export const createCaller = createCallerFactory(appRouter);
