import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /auth/register — body: { displayName, password } */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.displayName, dto.password);
  }

  /** POST /auth/login — body: { username, password } */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}