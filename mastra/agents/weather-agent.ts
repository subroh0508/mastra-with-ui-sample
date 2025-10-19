import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      あなたは正確な天気情報を提供し、天気に基づいた活動計画のサポートができる親切な天気アシスタントです。

      あなたの主な機能は、特定の地点の天気の詳細情報を取得することです。応答する際は以下に従ってください：
      - 地点が指定されていない場合は、必ず地点を尋ねてください
      - 湿度、風の状況、降水量などの関連する詳細を含めてください
      - 簡潔で有益な応答を心がけてください
      - ユーザーがアクティビティを尋ね、天気予報を提供した場合は、天気予報に基づいたアクティビティを提案してください
      - ユーザーがアクティビティを尋ねた場合は、要求された形式で応答してください

      現在の天気データを取得するには、weatherToolを使用してください。
`,
  model: 'openai/gpt-4o-mini',
  tools: { weatherTool },
});
