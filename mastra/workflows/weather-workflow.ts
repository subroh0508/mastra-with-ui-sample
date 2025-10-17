import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const locationInfoSchema = z.object({
  addressText: z.string(),
  addressLevel: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const forecastSchema = z.object({
  date: z.string(),
  maxTemp: z.number(),
  minTemp: z.number(),
  precipitationChance: z.number(),
  condition: z.string(),
  location: z.string(),
});

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
    61: 'やや弱い雨',
    63: '中程度の雨',
    65: '大雨',
    71: '小雪',
    73: '雪',
    75: '大雪',
    95: '雷雨',
  };
  return conditions[code] || '不明';
}

const geocodeLocation = createStep({
  id: 'geocode-location',
  description: '都市名から住所情報と緯度経度を取得します',
  inputSchema: z.object({
    city: z.string().describe('天気を取得する都市'),
  }),
  outputSchema: locationInfoSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const geocodingUrl = `https://navitime-geocoding.p.rapidapi.com/address/autocomplete?word=${encodeURIComponent(inputData.city)}&lang=ja&datum=wgs84&coord_unit=degree`;
    const geocodingResponse = await fetch(geocodingUrl, {
      headers: {
        'x-rapidapi-key': process.env.NAVITIME_API_KEY || '',
        'x-rapidapi-host': 'navitime-geocoding.p.rapidapi.com'
      }
    });
    const geocodingData = (await geocodingResponse.json()) as {
      items: Array<{
        name: string;
        coord: { lat: number; lon: number };
        details: Array<{ level: string }>;
      }>;
    };

    if (!geocodingData.items?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const item = geocodingData.items[0];
    const addressLevel = item.details[item.details.length - 1]?.level || '0';

    return {
      addressText: item.name,
      addressLevel,
      latitude: item.coord.lat,
      longitude: item.coord.lon,
    };
  },
});

const fetchWeather = createStep({
  id: 'fetch-weather',
  description: '緯度経度から天気予報を取得します',
  inputSchema: locationInfoSchema,
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { latitude, longitude, addressText } = inputData;

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,weathercode&timezone=auto,&hourly=precipitation_probability,temperature_2m`;
    const response = await fetch(weatherUrl);
    const data = (await response.json()) as {
      current: {
        time: string;
        precipitation: number;
        weathercode: number;
      };
      hourly: {
        precipitation_probability: number[];
        temperature_2m: number[];
      };
    };

    const forecast = {
      date: new Date().toISOString(),
      maxTemp: Math.max(...data.hourly.temperature_2m),
      minTemp: Math.min(...data.hourly.temperature_2m),
      condition: getWeatherCondition(data.current.weathercode),
      precipitationChance: data.hourly.precipitation_probability.reduce(
        (acc, curr) => Math.max(acc, curr),
        0,
      ),
      location: addressText,
    };

    return forecast;
  },
});

const planActivities = createStep({
  id: 'plan-activities',
  description: '天気条件に基づいてアクティビティを提案します',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const forecast = inputData;

    if (!forecast) {
      throw new Error('Forecast data not found');
    }

    const agent = mastra?.getAgent('weatherAgent');
    if (!agent) {
      throw new Error('Weather agent not found');
    }

    const prompt = `${forecast.location}の以下の天気予報に基づいて、適切なアクティビティを提案してください:
      ${JSON.stringify(forecast, null, 2)}
      予報の各日について、以下の形式で正確に回答してください:

      📅 [曜日、月 日、年]
      ═══════════════════════════

      🌡️ 天気の概要
      • 天候: [簡単な説明]
      • 気温: [X°C/Y°F から A°C/B°F]
      • 降水確率: [X%]

      🌅 午前中のアクティビティ
      屋外:
      • [アクティビティ名] - [具体的な場所やルートを含む簡単な説明]
        最適な時間: [具体的な時間帯]
        注意事項: [関連する天気の考慮事項]

      🌞 午後のアクティビティ
      屋外:
      • [アクティビティ名] - [具体的な場所やルートを含む簡単な説明]
        最適な時間: [具体的な時間帯]
        注意事項: [関連する天気の考慮事項]

      🏠 屋内の代替案
      • [アクティビティ名] - [具体的な施設を含む簡単な説明]
        理想的な条件: [この代替案が適している天候条件]

      ⚠️ 特別な注意事項
      • [関連する天気警報、UV指数、風の状況など]

      ガイドライン:
      - 1日あたり2〜3つの時間指定の屋外アクティビティを提案してください
      - 1〜2つの屋内の予備オプションを含めてください
      - 降水確率が50%を超える場合は、屋内アクティビティを優先してください
      - すべてのアクティビティは、その場所に特有のものでなければなりません
      - 具体的な施設、トレイル、または場所を含めてください
      - 気温に基づいてアクティビティの強度を考慮してください
      - 説明は簡潔かつ有益なものにしてください

      一貫性を保つため、絵文字とセクションヘッダーを示されたとおりに使用して、この正確な形式を維持してください。`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let activitiesText = '';

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      activitiesText += chunk;
    }

    return {
      activities: activitiesText,
    };
  },
});

const weatherWorkflow = createWorkflow({
  id: 'weather-workflow',
  inputSchema: z.object({
    city: z.string().describe('天気を取得する都市'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(geocodeLocation)
  .then(fetchWeather)
  .then(planActivities);

weatherWorkflow.commit();

export { weatherWorkflow };
