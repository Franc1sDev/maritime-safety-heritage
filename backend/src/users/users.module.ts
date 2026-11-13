import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MediaFile, Submission, User } from '../database/entities';
import { MediaModule } from '../media/media.module';
import { AccountController } from './account.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, MediaModule, TypeOrmModule.forFeature([User, Submission, MediaFile])],
  controllers: [UsersController, AccountController],
  providers: [UsersService],
})
export class UsersModule {}
