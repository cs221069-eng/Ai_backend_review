import mongoose from "mongoose";

let connectionPromise = null;

const connectDB = async () => {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is not defined");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 10000,
    })
    .then((connection) => {
      console.log("Connected to MongoDB");
      return connection;
    })
    .catch((error) => {
      connectionPromise = null;
      console.error("Error connecting to MongoDB:", error);
      throw error;
    });

  return connectionPromise;
};

export default connectDB;
