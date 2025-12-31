import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import { FilesService } from './files.service';
import { Public } from "../common/decorators";
import { Response } from 'express';

@Controller('files')
@Public()
export class FilesController {
constructor(private readonly filesService: FilesService) {}

// @Get(':id')
// async getFile(@Param('id') id: string, @Res() res: Response) {
// try {
// const file = await this.filesService.getFileInfo(id);
// if (!file) return res.status(HttpStatus.NOT_FOUND).send('File not found');
//   res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
//   res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

//   const stream = this.filesService.openDownloadStream(id);
//   stream.on('error', () => res.status(HttpStatus.NOT_FOUND).end());
//   stream.pipe(res);
// } catch {
//   return res.status(HttpStatus.BAD_REQUEST).send('Invalid file id');
// }
// }



@Get(':id')
async getFile(@Param('id') idParam: string, @Res() res: Response) {
  // Support both:
  //   /files/6953e197924dce01e4c4f891
  //   /files/6953e197924dce01e4c4f891.png
  const id = idParam.split('.')[0];   // remove ".png", ".jpg", etc if present

  try {
    const file = await this.filesService.getFileInfo(id);
    if (!file) return res.status(HttpStatus.NOT_FOUND).send('File not found');

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const stream = this.filesService.openDownloadStream(id);
    stream.on('error', () => res.status(HttpStatus.NOT_FOUND).end());
    stream.pipe(res);
  } catch {
    return res.status(HttpStatus.BAD_REQUEST).send('Invalid file id');
  }
}



}