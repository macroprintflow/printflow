
import {onRequest} from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
// Removed: import {generateCode} from "./generateCode";

// Optional helloWorld test endpoint
export const helloWorld = onRequest((req, res) => {
  logger.log("Hello from Firebase!");
  res.status(200).send("Hello from Firebase!");
});

// Removed: export {generateCode};
