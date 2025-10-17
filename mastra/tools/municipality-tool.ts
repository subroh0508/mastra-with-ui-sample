import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface NavitimeCoordinate {
  lat: number;
  lon: number;
}

interface NavitimeAddressDetail {
  code: string;
  name: string;
  ruby: string;
  level: string;
}

interface NavitimeGeocodingItem {
  code: string;
  name: string;
  postal_code: string;
  coord: NavitimeCoordinate;
  details: NavitimeAddressDetail[];
  is_end: boolean;
}

interface NavitimeGeocodingResponse {
  items: NavitimeGeocodingItem[];
}

export const municipalityTool = createTool({
  id: 'get-municipality',
  description: 'あいまいな場所の名前から住所情報と緯度経度を取得します',
  inputSchema: z.object({
    location: z.string().describe('場所の名前（例: 東京、松江市）'),
  }),
  outputSchema: z.object({
    name: z.string(),
    addressLevel: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  execute: async ({ context }) => {
    const geocodingUrl = `https://navitime-geocoding.p.rapidapi.com/address/autocomplete?word=${encodeURIComponent(context.location)}&lang=ja&datum=wgs84&coord_unit=degree`;

    const geocodingResponse = await fetch(geocodingUrl, {
      headers: {
        'x-rapidapi-key': process.env.NAVITIME_API_KEY || '',
        'x-rapidapi-host': 'navitime-geocoding.p.rapidapi.com'
      }
    });

    const geocodingData = (await geocodingResponse.json()) as NavitimeGeocodingResponse;

    if (!geocodingData.items?.[0]) {
      throw new Error(`Location '${context.location}' not found`);
    }

    const item = geocodingData.items[0];
    const addressLevel = item.details[item.details.length - 1]?.level || '0';

    return {
      name: item.name,
      addressLevel,
      latitude: item.coord.lat,
      longitude: item.coord.lon,
    };
  },
});
