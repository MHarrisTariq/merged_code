"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingMemoryModule = void 0;
const common_1 = require("@nestjs/common");
const ai_module_1 = require("../ai/ai.module");
const availability_memory_module_1 = require("../availability/availability-memory.module");
const decision_module_1 = require("../decision/decision.module");
const lock_module_1 = require("../lock/lock.module");
const sync_module_1 = require("../sync/sync.module");
const booking_controller_1 = require("./booking.controller");
const booking_memory_service_1 = require("./booking-memory.service");
const booking_service_1 = require("./booking.service");
let BookingMemoryModule = class BookingMemoryModule {
};
exports.BookingMemoryModule = BookingMemoryModule;
exports.BookingMemoryModule = BookingMemoryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            availability_memory_module_1.AvailabilityMemoryModule,
            lock_module_1.LockModule,
            decision_module_1.DecisionModule,
            ai_module_1.AiModule,
            sync_module_1.SyncModule,
        ],
        controllers: [booking_controller_1.BookingController],
        providers: [
            booking_memory_service_1.BookingMemoryService,
            { provide: booking_service_1.BookingService, useExisting: booking_memory_service_1.BookingMemoryService },
        ],
        exports: [booking_service_1.BookingService],
    })
], BookingMemoryModule);
//# sourceMappingURL=booking-memory.module.js.map