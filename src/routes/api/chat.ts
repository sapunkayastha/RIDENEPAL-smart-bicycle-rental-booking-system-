import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createAiProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are the RIDENEPAL AI assistant — a friendly, concise helper for a bicycle rental service in Nepal.

You help users with:
- Browsing and choosing bikes (city, electric, mountain — NPR 1,500–3,000/day)
- Understanding the booking flow (pick bike → dates → pickup location → checkout via eSewa)
- Payment questions (eSewa sandbox in test mode)
- Live GPS ride tracking after a booking is paid
- Trail and route suggestions around Kathmandu, Pokhara, and the Himalayas
- Rentals, extensions, cancellations (free cancel up to 48h before pickup)

Be warm, brief, and useful. Use markdown for lists. If you don't know something specific about the user's account, tell them to check their Dashboard.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.AI_GATEWAY_API_KEY;
        if (!key) return new Response("Missing AI_GATEWAY_API_KEY", { status: 500 });
        const baseURL = process.env.AI_GATEWAY_BASE_URL ?? "https://api.openai.com/v1";
        const model = process.env.AI_GATEWAY_MODEL ?? "gpt-4o-mini";

        const gateway = createAiProvider(key, baseURL);
        const result = streamText({
          model: gateway(model),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
