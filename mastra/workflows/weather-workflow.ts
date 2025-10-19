import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

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
    1: 'ほぼ晴れ',
    2: '一部曇り',
    3: '曇り',
    45: '霧',
    48: '霧氷',
    51: '軽い霧雨',
    53: '霧雨',
    55: '濃い霧雨',
    61: '小雨',
    63: '雨',
    65: '大雨',
    71: '小雪',
    73: '雪',
    75: '大雪',
    95: '雷雨',
  };
  return conditions[code] || '不明';
}

const fetchWeather = createStep({
  id: 'fetch-weather',
  description: '指定された都市の天気予報を取得する',
  inputSchema: z.object({
    city: z.string().describe('天気を取得する都市名'),
  }),
  outputSchema: forecastSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(inputData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = (await geocodingResponse.json()) as {
      results: { latitude: number; longitude: number; name: string }[];
    };

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${inputData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

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
      location: name,
    };

    return forecast;
  },
});

const planActivities = createStep({
  id: 'plan-activities',
  description: '天気条件に基づいてアクティビティを提案する',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string().describe('提案されたアクティビティ'),
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

    const prompt = `${forecast.location}の以下の天気予報に基づいて、適切なアクティビティを提案してください：
      ${JSON.stringify(forecast, null, 2)}
      予報の各日について、以下の形式で正確に回答してください：

      📅 [曜日、月 日、年]
      ═══════════════════════════

      🌡️ 天気の概要
      • 天候：[簡潔な説明]
      • 気温：[X°C から A°C]
      • 降水確率：[X%]

      🌅 午前中のアクティビティ
      屋外：
      • [アクティビティ名] - [具体的な場所/ルートを含む簡潔な説明]
        最適な時間帯：[具体的な時間帯]
        注意：[関連する天気の考慮事項]

      🌞 午後のアクティビティ
      屋外：
      • [アクティビティ名] - [具体的な場所/ルートを含む簡潔な説明]
        最適な時間帯：[具体的な時間帯]
        注意：[関連する天気の考慮事項]

      🏠 屋内の代替案
      • [アクティビティ名] - [具体的な会場を含む簡潔な説明]
        最適な条件：[この代替案が適している天候]

      ⚠️ 特別な注意事項
      • [関連する天気警報、UV指数、風の状況など]

      ガイドライン：
      - 1日あたり2〜3つの時間指定された屋外アクティビティを提案してください
      - 1〜2つの屋内の代替案を含めてください
      - 降水確率が50%を超える場合は、屋内アクティビティを優先してください
      - すべてのアクティビティは、その地域に特有のものでなければなりません
      - 具体的な会場、トレイル、場所を含めてください
      - 気温に基づいてアクティビティの強度を考慮してください
      - 簡潔で有益な説明を心がけてください

      一貫性を保つため、絵文字とセクションヘッダーを示されたとおりに使用してください。`;

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
    city: z.string().describe('天気を取得する都市名'),
  }),
  outputSchema: z.object({
    activities: z.string().describe('提案されたアクティビティ'),
  }),
})
  .then(fetchWeather)
  .then(planActivities);

weatherWorkflow.commit();

export { weatherWorkflow };
