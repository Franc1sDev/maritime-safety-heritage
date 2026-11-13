import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Meta, RequestMeta, Roles } from '../common/decorators';
import { RecordInputDto, RecordQuery, RecordUpdateDto } from './record.dto';
import { RecordsService } from './records.service';

@ApiTags('Archive') @ApiBearerAuth()
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get() @ApiOperation({ summary: 'Search and browse the archive' })
  search(@Query() q: RecordQuery, @CurrentUser() me: AuthUser) { return this.records.search(q, me); }

  @Get('map') @ApiOperation({ summary: 'Items with a location, for the incident map' })
  map(@CurrentUser() me: AuthUser) { return this.records.mapPoints(me); }

  @Get('facets') @ApiOperation({ summary: 'Counties and decades to offer as search filters' })
  facets() { return this.records.facets(); }

  @Roles('admin', 'editor') @Get('deleted') @ApiOperation({ summary: 'Deleted items that can be restored' })
  deleted() { return this.records.deleted(); }

  @Get(':id') @ApiOperation({ summary: 'One item with transcript, files and citation (by id or by identifier such as MSH-0001)' })
  get(@Param('id') id: string, @CurrentUser() me: AuthUser) { return this.records.detail(id.slice(0, 64), me); }

  @Roles('admin', 'editor') @Post() @ApiOperation({ summary: 'Catalogue a new item (saved as a draft)' })
  create(@Body() dto: RecordInputDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.records.create(dto, me, meta); }

  @Roles('admin', 'editor') @Patch(':id') @ApiOperation({ summary: 'Edit an item' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordUpdateDto, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) {
    return this.records.update(id, dto, me, meta);
  }

  @Roles('admin', 'editor') @Post(':id/publish') @HttpCode(200) @ApiOperation({ summary: 'Publish an item' })
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.records.setStatus(id, 'published', me, meta); }

  @Roles('admin', 'editor') @Post(':id/unpublish') @HttpCode(200) @ApiOperation({ summary: 'Take an item offline' })
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.records.setStatus(id, 'unpublished', me, meta); }

  @Roles('admin', 'editor') @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Delete an item (it can be restored)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.records.remove(id, me, meta); }

  @Roles('admin', 'editor') @Post(':id/restore') @HttpCode(200) @ApiOperation({ summary: 'Restore a deleted item as unpublished' })
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: AuthUser, @Meta() meta: RequestMeta) { return this.records.restore(id, me, meta); }
}
