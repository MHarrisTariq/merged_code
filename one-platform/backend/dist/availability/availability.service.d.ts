import { Model } from 'mongoose';
import { BookingDocument } from '../booking/schemas/booking.schema';
export declare class AvailabilityService {
    private bookingModel;
    constructor(bookingModel: Model<BookingDocument>);
    hasConflict(listingId: string, startDate: string, endDate: string, excludeId?: string): Promise<boolean>;
}
