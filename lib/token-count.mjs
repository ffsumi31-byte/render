import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("cl100k_base");
const MAX_EXACT_CHARS = 50_000;

function exactOrEstimate(text) {
  if (!text) return 0;
  if (text.length > MAX_EXACT_CHARS) return Math.ceil(text.length / 3.5);
  return encoding.encode(text, [], []).length;
}

function textOfSystem(system) {
  if (typeof system === "string") return system;
  if (!Array.isArray(system)) return "";
  return system.map((part) => typeof part === "string" ? part :
    part && typeof part.text === "string" ? part.text : "").filter(Boolean).join("\n");
}

export function countMessageTokens(body) {
  const pieces = [];
  let framing = 8;
  const system = textOfSystem(body.system);
  if (system) pieces.push(system);

  for (const message of Array.isArray(body.messages) ? body.messages : []) {
    if (!message) continue;
    framing += 16;
    if (typeof message.content === "string") {
      pieces.push(message.content);
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (!block || typeof block !== "object") continue;
        if (typeof block.text === "string") pieces.push(block.text);
        else if (typeof block.content === "string") pieces.push(block.content);
        else if (block.input !== undefined) pieces.push(JSON.stringify(block.input));
        else if (block.type === "image") framing += Math.ceil(4000 / 3.5);
      }
    }
  }
  for (const tool of Array.isArray(body.tools) ? body.tools : []) {
    if (tool) pieces.push(JSON.stringify(tool));
  }
  return exactOrEstimate(pieces.join("\n")) + framing;
}
