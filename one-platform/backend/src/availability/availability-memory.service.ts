import { Injectable } from '@nestjs/common';
import { devBookings } from '../dev/dev-booking.store';

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

@Injectable()
export class AvailabilityMemoryService {
  async hasConflict(
    listingId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<boolean> {
    for (const doc of devBookings) {
      if (doc.listingId !== listingId) continue;
      if (!['confirmed', 'pending'].includes(doc.status)) continue;
      if (excludeId && doc._id === excludeId) continue;
      if (rangesOverlap(startDate, endDate, doc.startDate, doc.endDate)) {
        return true;
      }
    }
    return false;
  }
}
