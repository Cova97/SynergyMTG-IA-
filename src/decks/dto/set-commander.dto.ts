import { IsNotEmpty, IsString } from 'class-validator';

export class SetCommanderDto {
  @IsString()
  @IsNotEmpty()
  cardId!: string;
}
