import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { DevUserGuard } from '../auth/dev-user.guard';
import { NotebooksService } from './notebooks.service';

@Controller('notebooks')
@UseGuards(DevUserGuard)
export class NotebooksController {
  constructor(private readonly notebooks: NotebooksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notebooks.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title?: string; targetMinutes?: number | null },
  ) {
    if (!body?.title?.trim()) throw new BadRequestException('title is required');
    return this.notebooks.create(user.id, {
      title: body.title.trim(),
      targetMinutes: body.targetMinutes ?? null,
    });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notebooks.get(user.id, id);
  }

  @Post(':id/pages')
  addPage(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notebooks.addPage(user.id, id);
  }

  @Delete(':id/pages/:pageId')
  removePage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ) {
    return this.notebooks.removePage(user.id, id, pageId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notebooks.remove(user.id, id);
  }
}
