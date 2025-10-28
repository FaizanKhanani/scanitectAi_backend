import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

@Injectable()
export class FilesService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private getBucket(bucketName = 'avatars') {
    return new GridFSBucket(this.connection.db, { bucketName });
  }

  // Upload a buffer to GridFS and return the file id as string
  async uploadFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    metadata?: Record<string, any>,
    bucketName = 'avatars',
  ): Promise<{ fileId: string; filename: string }> {
    const bucket = this.getBucket(bucketName);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType,
      metadata,
    });

    await new Promise<void>((resolve, reject) => {
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => resolve());
      // Write buffer directly and close the stream
      uploadStream.end(buffer);
    });

    return { fileId: uploadStream.id.toString(), filename };
  }

  

  async deleteById(fileId: string, bucketName = 'avatars'): Promise<boolean> {
    const bucket = this.getBucket(bucketName);
    try {
      await bucket.delete(new ObjectId(fileId));
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(fileId: string, bucketName = 'avatars'): Promise<any> {
    const bucket = this.getBucket(bucketName);
    const [file] = await bucket.find({ _id: new ObjectId(fileId) }).toArray();
    return file;
  }

  openDownloadStream(fileId: string, bucketName = 'avatars') {
    const bucket = this.getBucket(bucketName);
    return bucket.openDownloadStream(new ObjectId(fileId));
  }






  async uploadFromStream(
    readable: Readable, // Node readable stream
    filename: string,
    mimeType: string,
    metadata?: Record<string, any>,
    bucketName = 'avatars',
  ): Promise<{ fileId: string; filename: string }> {
    const bucket = this.getBucket(bucketName);
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType,
      metadata,
    });

    // Type cast is needed because GridFSBucketWriteStream write signature
    // is narrower (Buffer|string) than Node’s WritableStream (Uint8Array|string).
    await pipeline(
      readable as any,
      uploadStream as unknown as NodeJS.WritableStream,
    );

    return { fileId: String(uploadStream.id), filename };
  }
}