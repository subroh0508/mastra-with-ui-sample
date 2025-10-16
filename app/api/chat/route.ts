import { mastra } from "@/mastra"; // Adjust the import path if necessary
import { toAISdkFormat } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Extract the messages from the request body
  const { messages } = await req.json();

  // Get the chefAgent instance from Mastra
  const agent = mastra.getAgent("weatherAgent");

  // Stream the response using the agent
  const result = await agent.stream(messages);

  // Return the result as a data stream response
  // Workaround: https://discord.com/channels/1309558646228779139/1413241662091694100/1425928259513749554
  return createUIMessageStreamResponse({
    stream: toAISdkFormat(
      result,
      { from: "agent" },
    ),
  });
}
