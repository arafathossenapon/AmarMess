import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import type { Mess } from "./domain";
import { hashCode, validCode } from "./invite";

const globalDb = globalThis as typeof globalThis & {
  messAuth?: ReturnType<typeof makeAuth>;
  messConnection?: ReturnType<typeof mongoose.connect>;
};
const database = () => process.env.MONGODB_DB || "amarmess";
function uri() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  return process.env.MONGODB_URI;
}
function makeAuth() {
  const client = new MongoClient(uri());
  if (!process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) throw new Error("Better Auth configuration is required");
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: mongodbAdapter(client.db(database()), { client, transaction: false }),
    emailAndPassword: { enabled: true, minPasswordLength: 10 },

    databaseHooks: {
      user: { create: { before: async (user, context) => {
        const record = await readMess();
        const email = user.email.toLowerCase();
        // Only the configured owner or an address explicitly added by the manager may register.
        const setupCode = process.env.MESS_SETUP_CODE;
        const hash = record ? record.data.people.find(person => person.email === email)?.invite
          : email === process.env.MESS_SETUP_EMAIL?.trim().toLowerCase() && setupCode ? hashCode(setupCode) : undefined;
        if (!validCode(context?.headers?.get("x-mess-invite"), hash)) return false;
        return { data: { ...user, email } };
      } } },
    },
  });
}
export const auth = () => globalDb.messAuth ??= makeAuth();
const schema = new mongoose.Schema({
  _id: String,
  revision: { type: Number, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
}, { versionKey: false });
const Model = mongoose.models.MessLedger || mongoose.model("MessLedger", schema);
async function connect() {
  if (!globalDb.messConnection) {
    globalDb.messConnection = mongoose.connect(uri(), { dbName: database(), serverSelectionTimeoutMS: 5000, maxPoolSize: 8 })
      .catch(error => { globalDb.messConnection = undefined; throw error; });
  }
  await globalDb.messConnection;
}
export async function readMess() {
  await connect();
  return Model.findById("mess").lean<{ _id: string; revision: number; data: Mess }>().exec();
}
export async function createMess(data: Mess) {
  await connect();
  await Model.create({ _id: "mess", revision: 0, data });
}
export async function writeMess(revision: number, data: Mess | null) {
  const filter = { _id: "mess", revision };
  if (data === null) return (await Model.deleteOne(filter)).deletedCount === 1;
  return (await Model.updateOne(filter, { $set: { data }, $inc: { revision: 1 } })).modifiedCount === 1;
}
