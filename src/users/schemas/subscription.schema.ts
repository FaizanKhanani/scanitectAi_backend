import { Schema, Document } from 'mongoose';

export const SubscriptionSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true, // Ensure the email is unique in the collection
  },
});

export interface Subscription extends Document {
  email: string;
}