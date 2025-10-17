import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface WeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
}

export const weatherTool = createTool({
  id: 'get-weather',
  description: '緯度経度から現在の天気を取得します',
  inputSchema: z.object({
    latitude: z.number().describe('緯度'),
    longitude: z.number().describe('経度'),
    addressText: z.string().optional().describe('住所テキスト（表示用）'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    addressText: z.string().optional(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.latitude, context.longitude, context.addressText);
  },
});

const getWeather = async (latitude: number, longitude: number, addressText?: string) => {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as WeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    conditions: getWeatherCondition(data.current.weather_code),
    addressText,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: '快晴',
    1: '晴れ',
    2: '一部曇り',
    3: '曇り',
    45: '霧',
    48: '霧氷',
    51: '小雨',
    53: '雨',
    55: '強い雨',
    56: '凍る小雨',
    57: '凍る強い雨',
    61: 'やや弱い雨',
    63: '中程度の雨',
    65: '大雨',
    66: '凍る弱い雨',
    67: '凍る大雨',
    71: '小雪',
    73: '雪',
    75: '大雪',
    77: '霰',
    80: 'にわか雨（弱）',
    81: 'にわか雨（中）',
    82: 'にわか雨（強）',
    85: 'にわか雪（弱）',
    86: 'にわか雪（強）',
    95: '雷雨',
    96: '雷雨とやや強い雹',
    99: '雷雨と大粒の雹',
  };
  return conditions[code] || '不明';
}
