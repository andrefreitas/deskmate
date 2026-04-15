import Anthropic from "@anthropic-ai/sdk";
import { getState, getSpaceConfig } from "./storage";
import { dispatch, mapState } from "./tools";

const client = new Anthropic();

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "list_desks",
    description: "List all active desks with their availability for a given date.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
      },
    },
  },
  {
    name: "book_desk",
    description: "Book a desk for a member on a given date and slot.",
    input_schema: {
      type: "object",
      properties: {
        deskId: { type: "string", description: "e.g. D01" },
        memberId: { type: "string", description: "e.g. M01" },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        slot: { type: "string", enum: ["full", "am", "pm"], description: "Defaults to full." },
      },
      required: ["deskId", "memberId"],
    },
  },
  {
    name: "cancel_booking",
    description: "Cancel a booking by bookingId, or by deskId + date.",
    input_schema: {
      type: "object",
      properties: {
        bookingId: { type: "string" },
        deskId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "get_member",
    description: "Look up a member by name or ID.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Member name (partial) or ID like M01." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_bookings",
    description: "List bookings filtered by member and/or date range.",
    input_schema: {
      type: "object",
      properties: {
        memberId: { type: "string" },
        startDate: { type: "string", description: "YYYY-MM-DD" },
        endDate: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "suggest_desk",
    description: "Suggest the best available desk for a member based on their preferences.",
    input_schema: {
      type: "object",
      properties: {
        memberId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        slot: { type: "string", enum: ["full", "am", "pm"] },
      },
      required: ["memberId"],
    },
  },
  {
    name: "add_member",
    description: "Add a new member to the space.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        preferences: {
          type: "array",
          items: { type: "string" },
          description: "e.g. ['quiet', 'standing', 'near-window', 'monitor', 'phone-ok', 'collab']",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "set_map_date",
    description: "Change the date shown on the visual desk map.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
];

function buildSystemPrompt(): string {
  const state = getState();
  const space = getSpaceConfig();
  const today = new Date().toISOString().slice(0, 10);

  const desks = state.desks
    .filter((d) => d.active)
    .map((d) => `${d.id}(${d.zone}${d.features.length ? "," + d.features.join(",") : ""})`)
    .join(", ");

  const members = state.members
    .map((m) => `${m.id}=${m.name}`)
    .join(", ");

  const todayBookings = state.bookings.filter(
    (b) => b.date === today && !b.cancelledAt
  );
  const availability = state.desks
    .filter((d) => d.active)
    .map((d) => {
      const booked = todayBookings.find((b) => b.deskId === d.id);
      if (!booked) return `${d.id}:free`;
      const member = state.members.find((m) => m.id === booked.memberId);
      return `${d.id}:${member?.name.split(" ")[0] ?? "?"}(${booked.slot})`;
    })
    .join(", ");

  return `You are Deskmate, the AI manager for ${space.name}, a coworking space.

Today is ${today}.

Desks: ${desks}
Members: ${members}
Today's availability: ${availability}

Use tools to answer requests — never guess IDs. When booking, first use get_member to resolve the member ID from a name. Always confirm actions taken in a friendly, concise way. If something fails, explain why and suggest alternatives.`;
}

type Message = Anthropic.MessageParam;

export async function chat(
  history: Message[],
  userMessage: string
): Promise<{ response: string; history: Message[] }> {
  const messages: Message[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(),
    tools: TOOL_DEFINITIONS,
    messages,
  });

  const assistantMessages: Anthropic.MessageParam = {
    role: "assistant",
    content: response.content,
  };

  messages.push(assistantMessages);

  // Tool use loop
  while (response.stop_reason === "tool_use") {
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = dispatch(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOL_DEFINITIONS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "(no response)";

  // Keep only last 20 messages to avoid token bloat
  const trimmed = messages.slice(-20);

  return { response: text, history: trimmed };
}
