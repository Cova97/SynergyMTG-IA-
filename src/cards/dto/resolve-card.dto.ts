import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResolveCardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}
