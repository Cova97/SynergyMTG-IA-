import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AddCardToDeckDto {
  @IsString()
  @IsNotEmpty()
  cardId!: string; // id de Scryfall, debe existir en la coleccion del usuario

  @IsInt()
  @Min(1)
  quantity!: number;
}
