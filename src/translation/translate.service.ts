// import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
// import { HttpService } from '@nestjs/axios';
// import { firstValueFrom } from 'rxjs';

// @Injectable()
// export class TranslateService {
//   private readonly baseUrl =
//     process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
//   private readonly apiKey = process.env.LIBRETRANSLATE_API_KEY; // optional

//   constructor(private readonly http: HttpService) {}

//   private async detectLanguage(text: string): Promise<string> {
//     const { data } = await firstValueFrom(
//       this.http.post(`${this.baseUrl}/detect`, { q: text })
//     );
//     // data is like: [{ language: 'en', confidence: 0.99 }, ...]
//     return data?.[0]?.language || 'en';
//   }

//   async translate(
//     text: string,
//     target: string,
//     source = 'auto',
//     format: 'text' | 'html' = 'text'
//   ): Promise<string> {
//     if (!text?.trim()) {
//       throw new HttpException('Text is required', HttpStatus.BAD_REQUEST);
//     }
//     if (!target) {
//       throw new HttpException('Target language is required', HttpStatus.BAD_REQUEST);
//     }

//     let src = source;
//     if (source === 'auto' || !source) {
//       src = await this.detectLanguage(text);
//     }

//     const payload: any = { q: text, source: src, target, format };
//     if (this.apiKey) payload.api_key = this.apiKey;

//     try {
//       const { data } = await firstValueFrom(
//         this.http.post(`${this.baseUrl}/translate`, payload, {
//           headers: { 'Content-Type': 'application/json' },
//         })
//       );
//       return data?.translatedText ?? '';
//     } catch (err: any) {
//       const status = err?.response?.status ?? 502;
//       const msg =
//         err?.response?.data?.error ||
//         err?.message ||
//         'Translation failed';
//       throw new HttpException(msg, status);
//     }
//   }
// }














// src/translation/translation.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TranslationService {
  private readonly apiUrl = 'https://translation.googleapis.com/language/translate/v2';
  private readonly apiKey = process.env.GOOGLE_TRANSLATION_API ;

  // keys that MUST NOT be translated
  private readonly excludedKeys = ['id', 'thumbnailImage', 'originalImage'];

  constructor(private readonly http: HttpService) {}

  /**
   * Main method: translate your data object to targetLang.
   */
  async translateData<T = any>(data: T, targetLang: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
    }

    // 1. Collect all strings that need translation
    const itemsToTranslate: { path: (string | number)[]; value: string }[] = [];
    this.collectStrings(data, [], itemsToTranslate);

    if (itemsToTranslate.length === 0) {
      return data;
    }

    const texts = itemsToTranslate.map((i) => i.value);

    // 2. Call Google Translate API once for all strings
    const response$ = this.http.post(
      `${this.apiUrl}?key=${this.apiKey}`,
      {
        q: texts,
        target: targetLang,
        format: 'text', // treat as plain text, not HTML
      },
    );

    const response = await firstValueFrom(response$);
    const translations: { translatedText: string }[] = response.data.data.translations;

    if (!translations || translations.length !== itemsToTranslate.length) {
      throw new Error('Unexpected translation response from Google API');
    }

    // 3. Clone original data so we don't mutate input directly
    const result: any = JSON.parse(JSON.stringify(data));

    // 4. Put translated strings back into the object
    itemsToTranslate.forEach((item, index) => {
      const translated = translations[index].translatedText;
      this.setValueAtPath(result, item.path, translated);
    });

    return result as T;
  }

  /**
   * Recursively collect all strings that should be translated.
   * Skips keys in this.excludedKeys.
   */
  private collectStrings(
    current: any,
    currentPath: (string | number)[],
    out: { path: (string | number)[]; value: string }[],
  ) {
    if (current === null || current === undefined) return;

    // If it's a primitive string directly
    if (typeof current === 'string') {
      out.push({ path: currentPath, value: current });
      return;
    }

    // If it's an array, iterate elements
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        this.collectStrings(item, [...currentPath, index], out);
      });
      return;
    }

    // If it's an object, inspect each key
    if (typeof current === 'object') {
      Object.keys(current).forEach((key) => {
        if (this.excludedKeys.includes(key)) {
          // Skip translating this key's value entirely
          return;
        }

        const value = current[key];
        const newPath = [...currentPath, key];

        if (typeof value === 'string') {
          out.push({ path: newPath, value });
        } else if (Array.isArray(value) || typeof value === 'object') {
          this.collectStrings(value, newPath, out);
        }
      });
    }
  }

  /**
   * Set value into object by following a path like ['instanceOf', 1]
   */
  private setValueAtPath(obj: any, path: (string | number)[], value: any) {
    if (path.length === 0) {
      return;
    }

    const lastKey = path[path.length - 1];
    const parentPath = path.slice(0, -1);
    let current = obj;

    for (const key of parentPath) {
      if (current[key] === undefined) {
        // If missing, create an object or array based on the next key type
        current[key] = typeof key === 'number' ? [] : {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }
}