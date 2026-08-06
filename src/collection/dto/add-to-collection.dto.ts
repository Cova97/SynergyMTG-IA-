import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AddToCollectionDto {
  @IsString()
  @IsNotEmpty()
  cardName!: string; // se resuelve contra Scryfall via CardsService

  @IsInt()
  @Min(1)
  quantity!: number;
}
