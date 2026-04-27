export declare class CreateBookingDto {
    listingId: string;
    guestId: string;
    startDate: string;
    endDate: string;
    idempotencyKey: string;
    platform?: string;
    price?: number;
}
