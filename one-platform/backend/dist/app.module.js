"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const booking_memory_module_1 = require("./booking/booking-memory.module");
const booking_module_1 = require("./booking/booking.module");
const configuration_1 = require("./config/configuration");
const kafka_module_1 = require("./kafka/kafka.module");
const redis_module_1 = require("./redis/redis.module");
const ai_module_1 = require("./ai/ai.module");
const memoryMode = process.env.SWYFT_DEV_MEMORY === '1';
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default] }),
            ...(memoryMode
                ? []
                : [
                    mongoose_1.MongooseModule.forRootAsync({
                        useFactory: () => ({
                            uri: process.env.MONGODB_URI ??
                                'mongodb://127.0.0.1:27017/swyftbooking',
                        }),
                    }),
                ]),
            redis_module_1.RedisModule,
            kafka_module_1.KafkaModule,
            ai_module_1.AiModule,
            ...(memoryMode ? [booking_memory_module_1.BookingMemoryModule] : [booking_module_1.BookingModule]),
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map