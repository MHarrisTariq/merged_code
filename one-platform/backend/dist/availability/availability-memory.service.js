"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityMemoryService = void 0;
const common_1 = require("@nestjs/common");
const dev_booking_store_1 = require("../dev/dev-booking.store");
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}
let AvailabilityMemoryService = class AvailabilityMemoryService {
    async hasConflict(listingId, startDate, endDate, excludeId) {
        for (const doc of dev_booking_store_1.devBookings) {
            if (doc.listingId !== listingId)
                continue;
            if (!['confirmed', 'pending'].includes(doc.status))
                continue;
            if (excludeId && doc._id === excludeId)
                continue;
            if (rangesOverlap(startDate, endDate, doc.startDate, doc.endDate)) {
                return true;
            }
        }
        return false;
    }
};
exports.AvailabilityMemoryService = AvailabilityMemoryService;
exports.AvailabilityMemoryService = AvailabilityMemoryService = __decorate([
    (0, common_1.Injectable)()
], AvailabilityMemoryService);
//# sourceMappingURL=availability-memory.service.js.map