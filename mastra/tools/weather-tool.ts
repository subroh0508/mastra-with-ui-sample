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
  description: '緯度・経度から現在の天気を取得する',
  inputSchema: z.object({
    latitude: z.number().describe('緯度'),
    longitude: z.number().describe('経度'),
    address: z.string().describe('住所テキスト（表示用）'),
  }),
  outputSchema: z.object({
    temperature: z.number().describe('気温（℃）'),
    feelsLike: z.number().describe('体感温度（℃）'),
    humidity: z.number().describe('湿度（%）'),
    windSpeed: z.number().describe('風速（m/s）'),
    windGust: z.number().describe('最大瞬間風速（m/s）'),
    conditions: z.string().describe('天気の状態'),
    address: z.string().describe('住所テキスト'),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.latitude, context.longitude, context.address);
  },
});

const getWeather = async (latitude: number, longitude: number, address: string) => {
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
    address,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: '快晴',
    1: 'ほぼ晴れ',
    2: '一部曇り',
    3: '曇り',
    45: '霧',
    48: '霧氷',
    51: '軽い霧雨',
    53: '霧雨',
    55: '濃い霧雨',
    56: '軽い凍る霧雨',
    57: '濃い凍る霧雨',
    61: '小雨',
    63: '雨',
    65: '大雨',
    66: '軽い凍雨',
    67: '凍雨',
    71: '小雪',
    73: '雪',
    75: '大雪',
    77: 'あられ',
    80: 'にわか雨',
    81: '強いにわか雨',
    82: '激しいにわか雨',
    85: 'にわか雪',
    86: '激しいにわか雪',
    95: '雷雨',
    96: 'ひょうを伴う雷雨',
    99: '激しいひょうを伴う雷雨',
  };
  return conditions[code] || '不明';
}
