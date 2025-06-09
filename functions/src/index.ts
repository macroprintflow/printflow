import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// A minimal function so the file compiles.
export const helloWorld = onRequest((req, res) => {
  logger.log("Hello from Firebase!");
  res.status(200).send("Hello from Firebase!");
});
