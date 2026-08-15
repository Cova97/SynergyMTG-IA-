import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CardsService } from './cards.service';
import { ResolveCardDto } from './dto/resolve-card.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  /** POST /cards/resolve — body: { name: string } */
  @Post('resolve')
  resolve(@Body() dto: ResolveCardDto) {
    return this.cardsService.resolveByName(dto.name);
  }

  /** GET /cards/autocomplete?q=lightn */
  @Get('autocomplete')
  autocomplete(@Query('q') query: string) {
    return this.cardsService.autocomplete(query ?? '');
  }

  /** GET /cards/:id — solo cartas ya resueltas antes (cache) */
  @Get(':id')
  getById(@Param('id') id: string) {
    const card = this.cardsService.getById(id);
    if (!card) {
      throw new NotFoundException(`Carta "${id}" no esta en cache — resuelvela primero por nombre`);
    }
    return card;
  }
}
