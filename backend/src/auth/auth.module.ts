import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';

@Module({ controllers: [AuthController], providers: [AuthService, OAuthService], exports: [AuthService, OAuthService] })
export class AuthModule {}
