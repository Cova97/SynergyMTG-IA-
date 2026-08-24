import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { AddToCollectionDto } from './dto/add-to-collection.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';

// Protegido: el userId ya no viene de la URL (cualquiera podia pedir
// la coleccion de cualquier otro con solo saber su username) — ahora
// sale del token, que solo el dueno tiene. Mismo patron que ya usan
// DecksController y AnalysisController (@Req() + AuthenticatedRequest).
@UseGuards(JwtAuthGuard)
@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  addCard(@Req() req: AuthenticatedRequest, @Body() dto: AddToCollectionDto) {
    return this.collectionService.addCard(req.user!.username, dto.cardName, dto.quantity);
  }

  @Get()
  getCollection(@Req() req: AuthenticatedRequest) {
    return this.collectionService.getCollection(req.user!.username);
  }

  @Delete(':cardId')
  removeCard(
    @Req() req: AuthenticatedRequest,
    @Param('cardId') cardId: string,
    @Query('quantity') quantity: string,
  ) {
    this.collectionService.removeCard(req.user!.username, cardId, Number(quantity ?? 1));
    return { removed: true };
  }
}