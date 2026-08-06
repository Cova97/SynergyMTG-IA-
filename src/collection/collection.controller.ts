import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { AddToCollectionDto } from './dto/add-to-collection.dto';

// NOTA: userId viene como parametro de ruta por simplicidad — cuando
// se agregue autenticacion real, esto deberia salir del token/sesion
// en vez de la URL.
@Controller('collection/:userId')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  addCard(@Param('userId') userId: string, @Body() dto: AddToCollectionDto) {
    return this.collectionService.addCard(userId, dto.cardName, dto.quantity);
  }

  @Get()
  getCollection(@Param('userId') userId: string) {
    return this.collectionService.getCollection(userId);
  }

  @Delete(':cardId')
  removeCard(
    @Param('userId') userId: string,
    @Param('cardId') cardId: string,
    @Query('quantity') quantity: string,
  ) {
    this.collectionService.removeCard(userId, cardId, Number(quantity ?? 1));
    return { removed: true };
  }
}
