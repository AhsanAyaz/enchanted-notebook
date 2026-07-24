import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotebooksController } from './notebooks/notebooks.controller';
import { NotebooksService } from './notebooks/notebooks.service';
import { PrismaService } from './prisma/prisma.service';
import { LocalDiskStorage, LOCAL_STORAGE_ROOT } from './storage/local-disk.storage';
import { StorageService } from './storage/storage.service';
import { TurnsController } from './turns/turns.controller';
import { TurnsService } from './turns/turns.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: LOCAL_STORAGE_ROOT,
      serveRoot: '/files',
    }),
  ],
  controllers: [AppController, NotebooksController, TurnsController],
  providers: [
    AppService,
    PrismaService,
    NotebooksService,
    TurnsService,
    { provide: StorageService, useClass: LocalDiskStorage },
  ],
})
export class AppModule {}
