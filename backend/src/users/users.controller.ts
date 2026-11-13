import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { CreateUserDto, UpdateUserDto, UserQuery } from './user.dto';
import { UsersService } from './users.service';

@ApiTags('Admin: users') @ApiBearerAuth() @Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() @ApiOperation({ summary: 'List and search accounts' })
  list(@Query() q: UserQuery) { return this.users.list(q); }

  @Post() @ApiOperation({ summary: 'Create an account; returns a one-time temporary password' })
  create(@Body() dto: CreateUserDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.users.create(dto, me, meta); }

  @Patch(':id') @ApiOperation({ summary: 'Change name, organisation, role, or suspend / reactivate' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    return this.users.update(id, dto, me, meta);
  }

  @Post(':id/reset-password') @ApiOperation({ summary: 'Set a one-time temporary password' })
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    return this.users.resetPassword(id, me, meta);
  }
}
