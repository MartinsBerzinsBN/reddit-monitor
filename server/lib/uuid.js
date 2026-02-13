// https://www.npmjs.com/package/uuid
import { v4 as uuidv4 } from "uuid";
export function generateUUID() {
  try {
    return uuidv4();
  } catch (error) {
    console.error("Error generating UUID:", error);
    throw new Error("Failed to generate UUID");
  }
}
