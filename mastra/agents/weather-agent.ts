import { Agent } from '@mastra/core/agent';
import { municipalityTool } from '../tools/municipality-tool';
import { weatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      あなたは正確な天気情報を提供し、天気に基づいた活動計画のサポートができる親切な天気アシスタントです。

      天気情報を取得する際は、以下の2段階の手順で実行してください：
      1. まず municipalityTool を使用して、ユーザーが指定した地点名から緯度・経度・住所情報を取得してください
      2. 次に weatherTool を使用して、取得した緯度・経度・住所情報から天気情報を取得してください

      応答する際は以下に従ってください：
      - 地点が指定されていない場合は、必ず地点を尋ねてください
      - 湿度、風の状況、降水量などの関連する詳細を含めてください
      - 簡潔で有益な応答を心がけてください
      - ユーザーがアクティビティを尋ね、天気予報を提供した場合は、天気予報に基づいたアクティビティを提案してください
      - ユーザーがアクティビティを尋ねた場合は、要求された形式で応答してください
`,
  model: 'openai/gpt-4o-mini',
  tools: { municipalityTool, weatherTool },
});
