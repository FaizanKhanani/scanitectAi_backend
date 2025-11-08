import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TranslateService {
  private readonly baseUrl =
    process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
  private readonly apiKey = process.env.LIBRETRANSLATE_API_KEY; // optional

  constructor(private readonly http: HttpService) {}

  private async detectLanguage(text: string): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.post(`${this.baseUrl}/detect`, { q: text })
    );
    // data is like: [{ language: 'en', confidence: 0.99 }, ...]
    return data?.[0]?.language || 'en';
  }

  async translate(
    text: string,
    target: string,
    source = 'auto',
    format: 'text' | 'html' = 'text'
  ): Promise<string> {
    if (!text?.trim()) {
      throw new HttpException('Text is required', HttpStatus.BAD_REQUEST);
    }
    if (!target) {
      throw new HttpException('Target language is required', HttpStatus.BAD_REQUEST);
    }

    let src = source;
    if (source === 'auto' || !source) {
      src = await this.detectLanguage(text);
    }

    const payload: any = { q: text, source: src, target, format };
    if (this.apiKey) payload.api_key = this.apiKey;

    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.baseUrl}/translate`, payload, {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      return data?.translatedText ?? '';
    } catch (err: any) {
      const status = err?.response?.status ?? 502;
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Translation failed';
      throw new HttpException(msg, status);
    }
  }
}