import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PageQuery } from '../common/pagination';
import { RECORD_FORMATS, RECORD_STATUSES, RECORD_TYPES, RecordFormat, RecordStatus, RecordType } from '../database/entities';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const list = () => Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((s: string) => s.trim()).filter(Boolean) : value));

export class TranscriptSegmentDto {
  @ApiProperty() @IsInt() @Min(0) @Max(86400) startSeconds: number;
  @ApiProperty() @IsString() @Length(1, 5000) text: string;
}

export class RecordInputDto {
  @ApiProperty({ enum: RECORD_TYPES }) @IsIn(RECORD_TYPES) type: RecordType;
  @ApiProperty({ enum: RECORD_FORMATS }) @IsIn(RECORD_FORMATS) format: RecordFormat;
  @ApiProperty() @trim() @IsString() @Length(3, 300) title: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(2000) summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200_000) body?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1800) @Max(2200) year?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() yearApproximate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() waterBodyId?: number | null;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(80) county?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) place?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @Length(2, 80, { each: true }) subjects?: string[];
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) creator?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) narrator?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) interviewer?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) photographer?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(120) language?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(200) rights?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(300) consent?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(86400 * 2) durationSeconds?: number | null;
  @ApiPropertyOptional({ type: [TranscriptSegmentDto] }) @IsOptional() @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => TranscriptSegmentDto) transcript?: TranscriptSegmentDto[];
}

/** Same fields, all optional, for editing. */
export class RecordUpdateDto extends RecordInputDto {
  @ApiPropertyOptional({ enum: RECORD_TYPES }) @IsOptional() @IsIn(RECORD_TYPES) declare type: RecordType;
  @ApiPropertyOptional({ enum: RECORD_FORMATS }) @IsOptional() @IsIn(RECORD_FORMATS) declare format: RecordFormat;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @Length(3, 300) declare title: string;
}

export const SORTS = ['relevance', 'newest', 'oldest', 'title', 'popular', 'added'] as const;

export class RecordQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Words to search for. Quotes match a phrase; "or" and "-word" work too.' }) @IsOptional() @trim() @IsString() @MaxLength(200) q?: string;
  @ApiPropertyOptional({ description: 'One or more types, comma-separated' }) @IsOptional() @list() @IsArray() @IsIn(RECORD_TYPES, { each: true }) type?: RecordType[];
  @ApiPropertyOptional() @IsOptional() @list() @IsArray() @IsIn(RECORD_FORMATS, { each: true }) format?: RecordFormat[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() waterBodyId?: number;
  @ApiPropertyOptional({ description: 'Subject slug' }) @IsOptional() @IsString() @MaxLength(80) subject?: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(80) county?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1800) @Max(2200) yearFrom?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1800) @Max(2200) yearTo?: number;
  @ApiPropertyOptional({ enum: RECORD_STATUSES, description: 'Admins only; everyone else sees published items' }) @IsOptional() @IsIn(RECORD_STATUSES) status?: RecordStatus;
  @ApiPropertyOptional({ enum: SORTS }) @IsOptional() @IsIn(SORTS) sort?: (typeof SORTS)[number];
}
