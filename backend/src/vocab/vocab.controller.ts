import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { VocabService } from './vocab.service';

class SubjectDto { @ApiProperty() @IsString() @Length(2, 80) label: string }

@ApiTags('Vocabularies') @ApiBearerAuth()
@Controller('vocab')
export class VocabController {
  constructor(private readonly vocab: VocabService, private readonly activity: ActivityService) {}

  @Get() @ApiOperation({ summary: 'Item types, formats, water bodies and subjects' })
  all() { return this.vocab.all(); }

  @Roles('admin') @Post('subjects') @ApiOperation({ summary: 'Add a subject' })
  async add(@Body() dto: SubjectDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    const [s] = await this.vocab.ensureSubjects([dto.label]);
    await this.activity.record({ actor: me, action: 'subject.create', entityType: 'subject', entityId: String(s.id), summary: `Added subject "${s.label}"`, ip: meta.ip });
    return s;
  }

  @Roles('admin') @Patch('subjects/:id') @ApiOperation({ summary: 'Correct a subject label' })
  async rename(@Param('id', ParseIntPipe) id: number, @Body() dto: SubjectDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    const s = await this.vocab.renameSubject(id, dto.label);
    await this.activity.record({ actor: me, action: 'subject.update', entityType: 'subject', entityId: String(id), summary: `Renamed subject to "${s.label}"`, ip: meta.ip });
    return s;
  }

  @Roles('admin') @Delete('subjects/:id') @HttpCode(204) @ApiOperation({ summary: 'Remove a subject from the list and from every item' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    await this.vocab.deleteSubject(id);
    await this.activity.record({ actor: me, action: 'subject.delete', entityType: 'subject', entityId: String(id), summary: 'Removed a subject', ip: meta.ip });
  }
}
