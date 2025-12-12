import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import { Screenshot, DatabaseStats } from "@/types";

// Environment variable check moved to connection time to avoid build-time errors
function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please add your Mongo URI to .env.local");
  }
  return uri;
}
const dbName: string = process.env.MONGODB_DB_NAME || "screenshot_ocr";
const collectionName = "screenshots";

// Connection caching for Next.js serverless functions
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

interface ConnectResult {
  client: MongoClient;
  db: Db;
}

/**
 * Connect to MongoDB database with connection caching
 * Compatible with Next.js serverless functions
 */
export async function connectToDatabase(): Promise<ConnectResult> {
  // Return cached connection if available
  if (cachedClient && cachedDb) {
    // Check if connection is still alive
    try {
      await cachedClient.db().admin().ping();
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      // Connection is dead, reset cache
      cachedClient = null;
      cachedDb = null;
    }
  }

  // Create new connection with retry logic
  let retries = 2; // Reduced retries for faster failure
  let lastError: Error | null = null;

  while (retries > 0) {
    try {
      const client = new MongoClient(getMongoUri(), {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 2000, // Reduced from 5000ms for faster failure
        socketTimeoutMS: 10000, // Reduced from 45000ms
        connectTimeoutMS: 2000, // Add explicit connect timeout
      });

      await client.connect();
      const db = client.db(dbName);

      // Cache the connection
      cachedClient = client;
      cachedDb = db;

      // Ensure indexes exist
      await ensureIndexes(db);

      return { client, db };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retries--;

      if (retries > 0) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (4 - retries))
        );
      }
    }
  }

  throw new Error(
    `Failed to connect to MongoDB after retries: ${lastError?.message}`
  );
}

/**
 * Get database instance (cached)
 */
export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Get screenshots collection
 */
export async function getCollection(): Promise<Collection<Screenshot>> {
  const db = await getDatabase();
  return db.collection<Screenshot>(collectionName);
}

/**
 * Ensure database indexes exist
 */
async function ensureIndexes(db: Db): Promise<void> {
  try {
    const collection = db.collection(collectionName);

    // Create indexes
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ userId: 1 });

    console.log("MongoDB indexes ensured");
  } catch (error) {
    console.error("Error creating indexes:", error);
    // Don't throw - indexes might already exist
  }
}

/**
 * Save a screenshot to the database
 */
export async function saveScreenshot(
  data: Omit<Screenshot, "_id" | "createdAt">
): Promise<Screenshot> {
  const collection = await getCollection();

  const screenshot: Omit<Screenshot, "_id"> = {
    ...data,
    createdAt: new Date(),
  };

  const result = await collection.insertOne(screenshot as Screenshot);

  const created = await collection.findOne({ _id: result.insertedId });
  if (!created) {
    throw new Error("Failed to create screenshot");
  }

  return created;
}

/**
 * Get screenshot history (most recent first)
 */
export async function getScreenshotHistory(
  limit: number = 50
): Promise<Screenshot[]> {
  const collection = await getCollection();

  return collection.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

/**
 * Get a screenshot by ID
 */
export async function getScreenshotById(
  id: string
): Promise<Screenshot | null> {
  const collection = await getCollection();

  try {
    const objectId = new ObjectId(id);
    return collection.findOne({ _id: objectId });
  } catch (error) {
    // Invalid ObjectId format
    return null;
  }
}

/**
 * Delete a screenshot by ID
 */
export async function deleteScreenshot(id: string): Promise<boolean> {
  const collection = await getCollection();

  try {
    const objectId = new ObjectId(id);
    const result = await collection.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  } catch (error) {
    // Invalid ObjectId format
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getStats(): Promise<DatabaseStats> {
  const collection = await getCollection();

  const pipeline = [
    {
      $group: {
        _id: null,
        totalScreenshots: { $sum: 1 },
        totalTextLength: {
          $sum: { $strLenCP: "$extractedText" },
        },
        averageConfidence: { $avg: "$confidence" },
        totalTokens: {
          $sum: {
            $add: ["$promptTokens", "$completionTokens"],
          },
        },
      },
    },
  ];

  const result = await collection.aggregate(pipeline).toArray();

  if (result.length === 0) {
    return {
      totalScreenshots: 0,
      totalTextLength: 0,
      averageConfidence: 0,
      totalTokens: 0,
    };
  }

  return {
    totalScreenshots: result[0].totalScreenshots || 0,
    totalTextLength: result[0].totalTextLength || 0,
    averageConfidence: result[0].averageConfidence || 0,
    totalTokens: result[0].totalTokens || 0,
  };
}

// Export default for backward compatibility
export default connectToDatabase;
