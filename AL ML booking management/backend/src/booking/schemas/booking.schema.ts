import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ required: true }) listingId: string;
  @Prop({ required: true }) guestId: string;
  @Prop({ required: true }) startDate: string;
  @Prop({ required: true }) endDate: string;
  @Prop({ required: true, unique: true }) idempotencyKey: string;
  @Prop({ default: 'pending' }) status: string;
  @Prop() platform?: string;
  @Prop() price?: number;
  @Prop({ default: 'USD' }) currency: string;
  @Prop({ default: 1 }) version: number;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.index({ listingId: 1, startDate: 1, endDate: 1, status: 1 });
