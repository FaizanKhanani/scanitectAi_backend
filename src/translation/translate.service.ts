// // src/translation/translation.service.ts
// import { Injectable } from '@nestjs/common';
// import { HttpService } from '@nestjs/axios';
// import { firstValueFrom } from 'rxjs';

// @Injectable()
// export class TranslationService {
//   private readonly apiUrl = 'https://translation.googleapis.com/language/translate/v2';
//   private readonly apiKey = process.env.GOOGLE_TRANSLATION_API ;

//   // keys that MUST NOT be translated
//   private readonly excludedKeys = ['id', 'thumbnailImage', 'originalImage', 'image'];

//   constructor(private readonly http: HttpService) {}

//   /**
//    * Main method: translate your data object to targetLang.
//    */
//   async translateData<T = any>(data: T, targetLang: string): Promise<T> {
//     if (!this.apiKey) {
//       throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
//     }

//     // 1. Collect all strings that need translation
//     const itemsToTranslate: { path: (string | number)[]; value: string }[] = [];
//     this.collectStrings(data, [], itemsToTranslate);

//     if (itemsToTranslate.length === 0) {
//       return data;
//     }

//     const texts = itemsToTranslate.map((i) => i.value);

//     // 2. Call Google Translate API once for all strings
//     const response$ = this.http.post(
//       `${this.apiUrl}?key=${this.apiKey}`,
//       {
//         q: texts,
//         target: targetLang,
//         format: 'text', // treat as plain text, not HTML
//       },
//     );

//     const response = await firstValueFrom(response$);
//     const translations: { translatedText: string }[] = response.data.data.translations;

//     if (!translations || translations.length !== itemsToTranslate.length) {
//       throw new Error('Unexpected translation response from Google API');
//     }

//     // 3. Clone original data so we don't mutate input directly
//     const result: any = JSON.parse(JSON.stringify(data));

//     // 4. Put translated strings back into the object
//     itemsToTranslate.forEach((item, index) => {
//       const translated = translations[index].translatedText;
//       this.setValueAtPath(result, item.path, translated);
//     });

//     return result as T;
//   }

//   /**
//    * Recursively collect all strings that should be translated.
//    * Skips keys in this.excludedKeys.
//    */
//   private collectStrings(
//     current: any,
//     currentPath: (string | number)[],
//     out: { path: (string | number)[]; value: string }[],
//   ) {
//     if (current === null || current === undefined) return;

//     // If it's a primitive string directly
//     if (typeof current === 'string') {
//       out.push({ path: currentPath, value: current });
//       return;
//     }

//     // If it's an array, iterate elements
//     if (Array.isArray(current)) {
//       current.forEach((item, index) => {
//         this.collectStrings(item, [...currentPath, index], out);
//       });
//       return;
//     }

//     // If it's an object, inspect each key
//     if (typeof current === 'object') {
//       Object.keys(current).forEach((key) => {
//         if (this.excludedKeys.includes(key)) {
//           // Skip translating this key's value entirely
//           return;
//         }

//         const value = current[key];
//         const newPath = [...currentPath, key];

//         if (typeof value === 'string') {
//           out.push({ path: newPath, value });
//         } else if (Array.isArray(value) || typeof value === 'object') {
//           this.collectStrings(value, newPath, out);
//         }
//       });
//     }
//   }

//   /**
//    * Set value into object by following a path like ['instanceOf', 1]
//    */
//   private setValueAtPath(obj: any, path: (string | number)[], value: any) {
//     if (path.length === 0) {
//       return;
//     }

//     const lastKey = path[path.length - 1];
//     const parentPath = path.slice(0, -1);
//     let current = obj;

//     for (const key of parentPath) {
//       if (current[key] === undefined) {
//         // If missing, create an object or array based on the next key type
//         current[key] = typeof key === 'number' ? [] : {};
//       }
//       current = current[key];
//     }

//     current[lastKey] = value;
//   }
// }



















// // src/translation/translation.service.ts
// import { Injectable } from '@nestjs/common';
// import { HttpService } from '@nestjs/axios';
// import { firstValueFrom } from 'rxjs';
// import { AxiosError } from 'axios';

// @Injectable()
// export class TranslationService {
//   private readonly apiUrl =
//     'https://translation.googleapis.com/language/translate/v2';

//   // Make sure the env variable name matches what you actually use
//   private readonly apiKey = process.env.GOOGLE_TRANSLATION_API;

//   // keys that MUST NOT be translated
//   private readonly excludedKeys = ['id', 'thumbnailImage', 'originalImage', 'image'];

//   constructor(private readonly http: HttpService) {}

//   /**
//    * Generic method: translate a string OR any object/array.
//    * Returns the same shape with translated strings.
//    */
//   async translate<T = any>(data: T, targetLang: string): Promise<T> {
//     if (!this.apiKey) {
//       throw new Error('GOOGLE_TRANSLATION_API_KEY is not set');
//     }
//     if (!targetLang) {
//       throw new Error('Target language is required');
//     }

//     if (data === null || data === undefined) return data;


//     console.log("here in translate", data, "target lang", targetLang)
//     // Case 1: plain string
//     if (typeof data === 'string') {
//       const translated = await this.translateText(data, targetLang);

//       console.log("after translate", translated)
//       return translated as unknown as T;
//     }

//     // Case 2: any JSON-like object/array (your scan summary, list of buildings, etc.)
//     return this.translateData(data, targetLang);
//   }

//   /**
//    * Translate a single string.
//    */
//   private async translateText(text: string, targetLang: string): Promise<string> {
//     try{
//     const response$ = this.http.post(
//       `${this.apiUrl}?key=${this.apiKey}`,
//       {
//         q: text,
//         target: targetLang,
//         format: 'text',
//       },
//     );

//     const response = await firstValueFrom(response$);
//     const translations = response.data.data.translations;

//     console.log("the translation", translations,"the response", response)
//     return translations?.[0]?.translatedText ?? text;
//       } catch (err) {
//     const error = err as AxiosError;

//     console.error('Google Translate error status:', error.response?.status);
//     console.error('Google Translate error body:', JSON.stringify(error.response?.data, null, 2));
//     console.error('Google Translate error headers:', error.response?.headers);

//     // rethrow so Nest can handle it
//     throw err;
//   }
//   }

//   /**
//    * Translate all string fields in an object/array, keeping same structure.
//    */
//   private async translateData<T = any>(data: T, targetLang: string): Promise<T> {
//     // 1. Collect all strings
//     const itemsToTranslate: { path: (string | number)[]; value: string }[] = [];
//     this.collectStrings(data, [], itemsToTranslate);

//     if (itemsToTranslate.length === 0) {
//       return data;
//     }

//     const texts = itemsToTranslate.map((i) => i.value);

//     // 2. Single batch call to Google API
//     const response$ = this.http.post(
//       `${this.apiUrl}?key=${this.apiKey}`,
//       {
//         q: texts,
//         target: targetLang,
//         format: 'text',
//       },
//     );

//     const response = await firstValueFrom(response$);
//     const translations: { translatedText: string }[] =
//       response.data.data.translations;

//     if (!translations || translations.length !== itemsToTranslate.length) {
//       throw new Error('Unexpected translation response from Google API');
//     }

//     // 3. Clone original data
//     let result: any = JSON.parse(JSON.stringify(data));

//     // 4. Put translated strings back in
//     itemsToTranslate.forEach((item, index) => {
//       const translated = translations[index].translatedText;

//       if (item.path.length === 0) {
//         // Top-level primitive (e.g. data is just "hello")
//         result = translated;
//       } else {
//         this.setValueAtPath(result, item.path, translated);
//       }
//     });

//     return result as T;
//   }

//   /**
//    * Recursively collect all strings that should be translated.
//    */
//   private collectStrings(
//     current: any,
//     currentPath: (string | number)[],
//     out: { path: (string | number)[]; value: string }[],
//   ) {
//     if (current === null || current === undefined) return;

//     if (typeof current === 'string') {
//       out.push({ path: currentPath, value: current });
//       return;
//     }

//     if (Array.isArray(current)) {
//       current.forEach((item, index) => {
//         this.collectStrings(item, [...currentPath, index], out);
//       });
//       return;
//     }

//     if (typeof current === 'object') {
//       Object.keys(current).forEach((key) => {
//         if (this.excludedKeys.includes(key)) {
//           return; // skip these keys entirely
//         }

//         const value = current[key];
//         const newPath = [...currentPath, key];

//         if (typeof value === 'string') {
//           out.push({ path: newPath, value });
//         } else if (Array.isArray(value) || typeof value === 'object') {
//           this.collectStrings(value, newPath, out);
//         }
//       });
//     }
//   }

//   /**
//    * Set value into object by following a path like ['data', 0, 'title'].
//    */
//   private setValueAtPath(obj: any, path: (string | number)[], value: any) {
//     if (path.length === 0) {
//       return;
//     }

//     const lastKey = path[path.length - 1];
//     const parentPath = path.slice(0, -1);
//     let current = obj;

//     for (const key of parentPath) {
//       if (current[key] === undefined) {
//         current[key] = typeof key === 'number' ? [] : {};
//       }
//       current = current[key];
//     }

//     current[lastKey] = value;
//   }
// }


































// src/translation/translation.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class TranslationService {
  private readonly apiUrl =
    'https://translation.googleapis.com/language/translate/v2';

  // Make sure the env variable name matches what you actually use
  private readonly apiKey = process.env.GOOGLE_TRANSLATION_API;

  // keys that MUST NOT be translated
  private readonly excludedKeys = ['id', 'thumbnailImage', 'originalImage', 'image'];

  constructor(private readonly http: HttpService) {}

  /**
   * Check if error is a quota / rate-limit error from Google Translate.
   */
  private isQuotaError(err: any): boolean {
    const e = err as AxiosError;
    const status = e.response?.status;
    const body: any = e.response?.data;
    const reason = body?.error?.errors?.[0]?.reason;

    // common reasons: userRateLimitExceeded, rateLimitExceeded, dailyLimitExceeded
    return (
      status === 403 &&
      (
        reason === 'userRateLimitExceeded' ||
        reason === 'rateLimitExceeded' ||
        reason === 'dailyLimitExceeded'
      )
    );
  }

  /**
   * Generic method: translate a string OR any object/array.
   * Returns the same shape with translated strings.
   * If translation fails (quota, network, etc.), it returns the original data.
   */
  async translate<T = any>(data: T, targetLang: string): Promise<T> {
    // If no data, just return it
    if (data === null || data === undefined) return data;

    // If no target language or same as source (en), don't call Google
    if (!targetLang || targetLang === 'en') {
      return data;
    }

    // If no API key configured, fail-soft and return original
    if (!this.apiKey) {
      console.warn('GOOGLE_TRANSLATION_API is not set, returning original text.');
      return data;
    }

    console.log('here in translate', data, 'target lang', targetLang);

    try {
      // Case 1: plain string
      if (typeof data === 'string') {
        const translated = await this.translateText(data, targetLang);
        console.log('after translate', translated);
        return translated as unknown as T;
      }

      // Case 2: any JSON-like object/array
      const translatedData = await this.translateData(data, targetLang);
      return translatedData;
    } catch (err) {
      // If quota / rate-limit error: return original text
      if (this.isQuotaError(err)) {
        console.warn(
          'Google Translate quota / rate limit exceeded. Returning original text.',
        );
        return data;
      }

      // Log unexpected errors but still fail-soft
      const error = err as AxiosError;
      console.error('Google Translate unexpected error status:', error.response?.status);
      console.error(
        'Google Translate unexpected error body:',
        JSON.stringify(error.response?.data, null, 2),
      );
      console.error('Google Translate unexpected error headers:', error.response?.headers);

      // Fallback: return original data (English)
      return data;
    }
  }

  /**
   * Translate a single string.
   * Errors are handled by the caller (translate()).
   */
  private async translateText(text: string, targetLang: string): Promise<string> {
    const response$ = this.http.post(
      `${this.apiUrl}?key=${this.apiKey}`,
      {
        q: text,
        target: targetLang,
        format: 'text',
      },
    );

    const response = await firstValueFrom(response$);
    const translations = response.data.data.translations;

    console.log('the translation', translations, 'the response', response.data);
    return translations?.[0]?.translatedText ?? text;
  }

  /**
   * Translate all string fields in an object/array, keeping same structure.
   * Errors are handled by the caller (translate()).
   */
  private async translateData<T = any>(data: T, targetLang: string): Promise<T> {
    // 1. Collect all strings
    const itemsToTranslate: { path: (string | number)[]; value: string }[] = [];
    this.collectStrings(data, [], itemsToTranslate);

    if (itemsToTranslate.length === 0) {
      return data;
    }

    const texts = itemsToTranslate.map((i) => i.value);

    // 2. Single batch call to Google API
    const response$ = this.http.post(
      `${this.apiUrl}?key=${this.apiKey}`,
      {
        q: texts,
        target: targetLang,
        format: 'text',
      },
    );

    const response = await firstValueFrom(response$);
    const translations: { translatedText: string }[] =
      response.data.data.translations;

    if (!translations || translations.length !== itemsToTranslate.length) {
      throw new Error('Unexpected translation response from Google API');
    }

    // 3. Clone original data
    let result: any = JSON.parse(JSON.stringify(data));

    // 4. Put translated strings back in
    itemsToTranslate.forEach((item, index) => {
      const translated = translations[index].translatedText;

      if (item.path.length === 0) {
        // Top-level primitive (e.g. data is just "hello")
        result = translated;
      } else {
        this.setValueAtPath(result, item.path, translated);
      }
    });

    return result as T;
  }

  /**
   * Recursively collect all strings that should be translated.
   */
  private collectStrings(
    current: any,
    currentPath: (string | number)[],
    out: { path: (string | number)[]; value: string }[],
  ) {
    if (current === null || current === undefined) return;

    if (typeof current === 'string') {
      out.push({ path: currentPath, value: current });
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        this.collectStrings(item, [...currentPath, index], out);
      });
      return;
    }

    if (typeof current === 'object') {
      Object.keys(current).forEach((key) => {
        if (this.excludedKeys.includes(key)) {
          return; // skip these keys entirely
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
   * Set value into object by following a path like ['data', 0, 'title'].
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
        current[key] = typeof key === 'number' ? [] : {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  }
}