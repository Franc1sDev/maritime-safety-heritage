import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Equals, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { PageQuery } from '../common/pagination';
import { RECORD_TYPES, RecordType } from '../database/entities';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const emptyToUndefined = () => Transform(({ value }) => (value === '' || value === 'null' ? undefined : value));

/** Sent as multipart form fields, so numbers and booleans arrive as text. */
export class SubmissionInputDto {
  @ApiProperty({ enum: RECORD_TYPES }) @IsIn(RECORD_TYPES) type: RecordType;
  @ApiProperty() @trim() @IsString() @Length(3, 300) title: string;
  @ApiProperty() @trim() @IsString() @Length(10, 10_000, { message: 'Describe the item in at least a sentence (10 characters).' }) description: string;
  @ApiPropertyOptional() @IsOptional() @emptyToUndefined() @Type(() => Number) @IsInt() @Min(1800) @Max(2200) year?: number;
  @ApiPropertyOptional() @IsOptional() @emptyToUndefined() @Type(() => Number) @IsInt() waterBodyId?: number;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) place?: string;
  @ApiProperty({ description: 'Must be true: you have the right to share this and the people in it agreed' })
  @Transform(({ value }) => value === true || value === 'true' || value === 'on') @Equals(true, { message: 'Confirm that you have permission to share this item.' })
  consentConfirmed: boolean;
}

export class ReviewDto {
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(2000) reviewNote?: string;
}

export class RejectDto {
  @ApiProperty() @trim() @IsString() @Length(5, 2000, { message: 'Tell the contributor why (at least 5 characters).' }) reviewNote: string;
}

export class SubmissionQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] }) @IsOptional() @IsIn(['pending', 'approved', 'rejected']) status?: 'pending' | 'approved' | 'rejected';
}
