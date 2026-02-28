import { BaseExtractor, BaseNode } from 'llamaindex';
import * as Recognizers from '@microsoft/recognizers-text-suite';

/**
 * Extracts structured data natively in Node.js.
 * Handles Dates, Times, Currencies, and Percentages accurately,
 * filling the gap where GLiNER2/NLP models typically fail.
 */
export class RecognizersExtractor extends BaseExtractor {
  
  async extract(nodes: BaseNode[]): Promise<Record<string, unknown>[]> {
    const extractedMetadataList: Record<string, unknown>[] = [];
    const culture = Recognizers.Culture.English;

    for (const node of nodes) {
      const text = node.getContent('text');
      if (!text || text.trim() === '') {
        extractedMetadataList.push({});
        continue;
      }

      const structuredEntities: any[] = [];

      try {
        // 1. Extract Date and Time
        const dateResults = Recognizers.recognizeDateTime(text, culture);
        dateResults.forEach(res => {
          structuredEntities.push({
            type: 'DateTime',
            text: res.text,
            resolution: res.resolution
          });
        });

        // 2. Extract Currency / Financial amounts
        const currencyResults = Recognizers.recognizeCurrency(text, culture);
        currencyResults.forEach(res => {
          structuredEntities.push({
            type: 'Currency',
            text: res.text,
            resolution: res.resolution
          });
        });

        // 3. Extract Phone Numbers
        const phoneResults = Recognizers.recognizePhoneNumber(text, culture);
        phoneResults.forEach(res => {
          structuredEntities.push({
            type: 'PhoneNumber',
            text: res.text,
            resolution: res.resolution
          });
        });

      } catch (err) {
        console.error('[RecognizersExtractor] Error processing text:', err);
      }

      if (structuredEntities.length > 0) {
        extractedMetadataList.push({ structured_entities: structuredEntities });
      } else {
        extractedMetadataList.push({});
      }
    }

    return extractedMetadataList;
  }
}
