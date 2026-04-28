import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create(dto);
  }

  @Get('listing/:listingId')
  listByListing(@Param('listingId') listingId: string) {
    return this.bookings.listForListing(listingId);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.bookings.findById(id);
  }
}
