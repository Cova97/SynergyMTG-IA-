import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string; // el que el sistema genero al registrarse (ej. "aldo")

  @IsString()
  @IsNotEmpty()
  password!: string;
}