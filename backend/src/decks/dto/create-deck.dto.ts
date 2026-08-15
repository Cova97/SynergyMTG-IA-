import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const DECK_FORMATS = ['casual', 'competitive', 'commander', 'experimental'] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

export class CreateDeckDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(DECK_FORMATS)
  format!: DeckFormat;
}
