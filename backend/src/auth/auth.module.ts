import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailService } from '../common/mail.service';
import { PasswordResetToken, RefreshToken, User } from '../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken])],
  controllers: [AuthController],
  providers: [AuthService, MailService],
  exports: [AuthService, MailService, JwtModule],
})
export class AuthModule {}
