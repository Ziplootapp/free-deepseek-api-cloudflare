export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("POST requests only", { status: 405 });
    }

    // Authentication check
    const authHeader = request.headers.get("Authorization");
    const expectedToken = `Bearer ${env.API_KEY}`;
    if (!authHeader || authHeader !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid API Key" }), {
        status: 401,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    try {
      const body = await request.json();
      const messages = body.messages || [];
      
      // Default to DeepSeek R1 model on Cloudflare Workers AI
      const model = body.model || "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

      // Execute Cloudflare AI run with maximum output token limit (4096)
      const aiResponse = await env.AI.run(model, {
        messages: messages,
        max_tokens: body.max_tokens || 4096
      });

      // Convert Workers AI response structure to OpenAI Chat Completion Format
      const responseBody = {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: aiResponse.response || aiResponse.text || ""
            },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.toString() }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }
};
