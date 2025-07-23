import { hashPassword } from "./auth";
import { DatabaseStorage } from "./storage";
import dotenv from "dotenv";

dotenv.config();

async function createDemoUser() {
  const storage = new DatabaseStorage();
  
  try {
    // Check if demo user already exists
    const existingUser = await storage.getUserByUsername("demo");
    if (existingUser) {
      console.log("Demo user already exists");
      return;
    }
    
    // Create demo user
    const hashedPassword = await hashPassword("demo123");
    const user = await storage.createUser({
      username: "demo",
      email: "demo@example.com",
      password: hashedPassword,
    });
    
    console.log("Demo user created successfully:");
    console.log("Username: demo");
    console.log("Password: demo123");
    console.log("User ID:", user.id);
  } catch (error) {
    console.error("Error creating demo user:", error);
  } finally {
    process.exit(0);
  }
}

createDemoUser();