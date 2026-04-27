export type DevBookingRow = {
    _id: string;
    listingId: string;
    guestId: string;
    startDate: string;
    endDate: string;
    idempotencyKey: string;
    status: string;
    platform?: string;
    price?: number;
    currency: string;
    version: number;
    createdAt?: Date;
    updatedAt?: Date;
};
export declare const devBookings: DevBookingRow[];
