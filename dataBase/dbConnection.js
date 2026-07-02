import mongoose from "mongoose";

// Cache the connection across serverless invocations so we don't open a
// new connection (and exhaust the pool) on every single request.
let cached = global._mongoose;

if (!cached) {
    cached = global._mongoose = { conn: null, promise: null };
}

export async function dbConnection() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(process.env.MONGODB_URL, {
                bufferCommands: false,
            })
            .then((con) => {
                console.log(`Connected to Database: ${con.connection.host}`);
                return con;
            });
    }

    try {
        cached.conn = await cached.promise;
        return cached.conn;
    } catch (err) {
        cached.promise = null; // allow retry on next request
        console.error(`Database Connection Failed: ${err.message}`);
        throw err; // let the caller (route/middleware) return a proper error response
    }
}