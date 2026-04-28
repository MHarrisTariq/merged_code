import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../booking/schemas/booking.schema';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async hasConflict(
    listingId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<boolean> {
    const q: Record<string, unknown> = {
      listingId,
      status: { $in: ['confirmed', 'pending'] },
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
    };
    if (excludeId) {
      q._id = { $ne: excludeId };
    }

    const hit = await this.bookingModel.findOne(q).select({ _id: 1 }).lean();
    return Boolean(hit);
  }
}
