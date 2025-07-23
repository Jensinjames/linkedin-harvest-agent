import { hashPassword } from "./auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function updateDemoPassword() {
  try {
    const hashedPassword = await hashPassword("demo123");
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, 2));
    console.log("Password updated successfully for user demo");
  } catch (error) {
    console.error("Error updating password:", error);
  } finally {
    process.exit(0);
  }
}

updateDemoPassword();