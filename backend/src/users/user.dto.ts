import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_TEXT } from '../common/crypto';
import { PageQuery } from '../common/pagination';
import { Role, User } from '../database/entities';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class EmailField { @ApiProperty() @lower() @IsEmail({}, { message: 'Enter a valid email address.' }) @MaxLength(254) email: string }

export class RegisterDto extends EmailField {
  @ApiProperty() @trim() @IsString() @Length(2, 120, { message: 'Enter your name (2 to 120 characters).' }) name: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_TEXT }) password: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(160) organisation?: string;
}

export class LoginDto extends EmailField {
  @ApiProperty() @IsString() @Length(1, 128) password: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Only for the mobile app. The website uses a secure cookie instead.' })
  @IsOptional() @IsString() @MaxLength(200) refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @Length(1, 128) currentPassword: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_TEXT }) newPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @Length(20, 200) token: string;
  @ApiProperty() @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_TEXT }) password: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(160) organisation?: string;
}

export class CreateUserDto extends EmailField {
  @ApiProperty() @trim() @IsString() @Length(2, 120) name: string;
  @ApiProperty({ enum: ['user', 'editor', 'admin'] }) @IsIn(['user', 'editor', 'admin']) role: Role;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(160) organisation?: string;
}

export class UpdateUserDto extends UpdateProfileDto {
  @ApiPropertyOptional({ enum: ['user', 'editor', 'admin'] }) @IsOptional() @IsIn(['user', 'editor', 'admin']) role?: Role;
  @ApiPropertyOptional({ enum: ['active', 'suspended'] }) @IsOptional() @IsIn(['active', 'suspended']) status?: 'active' | 'suspended';
}

export class UserQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional({ enum: ['user', 'editor', 'admin'] }) @IsOptional() @IsIn(['user', 'editor', 'admin']) role?: Role;
  @ApiPropertyOptional({ enum: ['active', 'suspended', 'deleted'] }) @IsOptional() @IsIn(['active', 'suspended', 'deleted']) status?: 'active' | 'suspended' | 'deleted';
}

export const publicUser = (u: User) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, organisation: u.organisation,
  lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
});
export type PublicUser = ReturnType<typeof publicUser>;
