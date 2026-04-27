import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingService } from './booking.service';
export declare class BookingController {
    private readonly bookings;
    constructor(bookings: BookingService);
    create(dto: CreateBookingDto): Promise<{
        booking: import("mongoose").Document<unknown, {}, import("./schemas/booking.schema").Booking, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/booking.schema").Booking & {
            _id: import("mongoose").Types.ObjectId;
        } & {
            __v: number;
        } & {
            id: string;
        } & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>;
        idempotent: boolean;
    }>;
    listByListing(listingId: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/booking.schema").Booking, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/booking.schema").Booking & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[]>;
    getOne(id: string): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/booking.schema").Booking, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/booking.schema").Booking & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>) | null>;
}
