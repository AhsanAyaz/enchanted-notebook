import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotebooksService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notebook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    userId: string,
    data: { title: string; targetMinutes?: number | null },
  ) {
    const notebook = await this.prisma.notebook.create({
      data: {
        userId,
        title: data.title,
        targetMinutes: data.targetMinutes ?? null,
        // Every notebook starts with page one.
        pages: { create: { index: 0 } },
      },
      include: { pages: true },
    });
    return notebook;
  }

  async get(userId: string, id: string) {
    const notebook = await this.prisma.notebook.findFirst({
      where: { id, userId },
      include: {
        pages: {
          orderBy: { index: 'asc' },
          include: { turns: { orderBy: { seq: 'asc' } } },
        },
      },
    });
    if (!notebook) throw new NotFoundException('notebook not found');
    return notebook;
  }

  async addPage(userId: string, notebookId: string) {
    // Ownership check + next index in one round trip each.
    const notebook = await this.prisma.notebook.findFirst({
      where: { id: notebookId, userId },
      select: { id: true },
    });
    if (!notebook) throw new NotFoundException('notebook not found');
    const last = await this.prisma.page.findFirst({
      where: { notebookId },
      orderBy: { index: 'desc' },
      select: { index: true },
    });
    return this.prisma.page.create({
      data: { notebookId, index: (last?.index ?? -1) + 1 },
    });
  }

  /** Tear out a page (and its turns). The last page can't be torn out. */
  async removePage(userId: string, notebookId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, notebookId, notebook: { userId } },
      select: { id: true },
    });
    if (!page) throw new NotFoundException('page not found');
    const count = await this.prisma.page.count({ where: { notebookId } });
    if (count <= 1) {
      throw new BadRequestException('a notebook keeps at least one page');
    }
    await this.prisma.page.delete({ where: { id: pageId } });
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    const notebook = await this.prisma.notebook.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!notebook) throw new NotFoundException('notebook not found');
    await this.prisma.notebook.delete({ where: { id } });
    return { ok: true };
  }
}
