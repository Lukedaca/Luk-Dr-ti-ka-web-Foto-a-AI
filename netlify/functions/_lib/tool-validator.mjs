// Lightweight validator for tool call arguments.
// Avoids ajv dependency — implements just what we need from JSON Schema.

import { TOOLS, isWhitelistedTool, MAX_ACTIONS_PER_RESPONSE } from "./tools.mjs";

const FORBIDDEN_PROMISE_PATTERNS = [
  /\bslev[a-zěščřžýáíéúůďťň]{0,4}\b/i,
  /\bvýhodněj[a-zěščřžýáíéúůďťň]{0,3}\b/i,
  /\bvyhodnej[a-z]{0,3}\b/i,
  /\blevněj[a-zěščřžýáíéúůďťň]{0,3}\b/i,
  /\blevnej[a-z]{0,3}\b/i,
  /\bzdarma\s+(navic|navíc|k\s+tomu|extra)\b/i,
  /\bexkluzivn[ěe]\s+pro\s+tebe\b/i,
  /\bspeci[aá]ln[ií]\s+cena\b/i,
  /\bdiscount\b/i,
];

const PROMPT_LEAK_PATTERNS = [
  /\btool\s+call\b/i,
  /\bsystem\s+handle\b/i,
  /\blet'?s\s+draft\b/i,
  /\bdraft\s+the\s+response\b/i,
  /\binternal\s+(instruction|prompt|reasoning)\b/i,
  /\bsystem\s+prompt\b/i,
  /\bdeveloper\s+message\b/i,
  /\bfunction\s+call\b/i,
  /\bthe\s+response\s*:\s*["“]/i,
];

function validateValue(value, schema, path) {
  const errors = [];
  if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path}: expected string`);
      return errors;
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path}: too short (min ${schema.minLength})`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push(`${path}: too long (max ${schema.maxLength})`);
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push(`${path}: not in enum (${schema.enum.join("|")})`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`);
      return errors;
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${path}: too many items (max ${schema.maxItems})`);
    }
    if (schema.items) {
      value.forEach((item, idx) => {
        errors.push(...validateValue(item, schema.items, `${path}[${idx}]`));
      });
    }
  } else if (schema.type === "object") {
    if (typeof value !== "object" || value === null) {
      errors.push(`${path}: expected object`);
      return errors;
    }
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          errors.push(...validateValue(value[key], subSchema, `${path}.${key}`));
        }
      }
    }
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) errors.push(`${path}.${key}: required`);
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${path}.${key}: unexpected property`);
      }
    }
  } else if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number") errors.push(`${path}: expected number`);
  } else if (schema.type === "boolean") {
    if (typeof value !== "boolean") errors.push(`${path}: expected boolean`);
  }
  return errors;
}

function validateToolArgs(toolName, args) {
  if (!isWhitelistedTool(toolName)) {
    return { ok: false, errors: [`tool '${toolName}' not whitelisted`] };
  }
  const tool = TOOLS.find((t) => t.function.name === toolName);
  const schema = tool.function.parameters || {};
  const errors = validateValue(args || {}, schema, toolName);
  return { ok: errors.length === 0, errors };
}

function detectForbiddenPromise(text) {
  if (typeof text !== "string") return { detected: false };
  const matches = [];
  for (const re of FORBIDDEN_PROMISE_PATTERNS) {
    if (re.test(text)) matches.push(re.source);
  }
  return { detected: matches.length > 0, patterns: matches };
}

function detectPromptLeak(text) {
  if (typeof text !== "string") return { detected: false };
  const matches = [];
  for (const re of PROMPT_LEAK_PATTERNS) {
    if (re.test(text)) matches.push(re.source);
  }
  return { detected: matches.length > 0, patterns: matches };
}

function sanitizeToolCalls(rawCalls) {
  if (!Array.isArray(rawCalls)) return { actions: [], errors: ["tool_calls not an array"] };
  const errors = [];
  const actions = [];

  const trimmed = rawCalls.slice(0, MAX_ACTIONS_PER_RESPONSE);
  if (rawCalls.length > MAX_ACTIONS_PER_RESPONSE) {
    errors.push(`too many actions (got ${rawCalls.length}, max ${MAX_ACTIONS_PER_RESPONSE})`);
  }

  for (const call of trimmed) {
    if (!call || typeof call.name !== "string") {
      errors.push("invalid tool call shape");
      continue;
    }
    const validation = validateToolArgs(call.name, call.args || {});
    if (!validation.ok) {
      errors.push(`${call.name}: ${validation.errors.join("; ")}`);
      continue;
    }
    actions.push({
      tool: call.name,
      args: call.args || {},
      id: call.id,
    });
  }

  return { actions, errors };
}

function validateAgentText(text) {
  const promptLeak = detectPromptLeak(text);
  if (promptLeak.detected) {
    return { ok: false, reason: "prompt_leak", patterns: promptLeak.patterns };
  }

  const promise = detectForbiddenPromise(text);
  if (promise.detected) {
    return { ok: false, reason: "forbidden_promise", patterns: promise.patterns };
  }
  return { ok: true };
}

export {
  validateToolArgs,
  detectForbiddenPromise,
  detectPromptLeak,
  sanitizeToolCalls,
  validateAgentText,
  FORBIDDEN_PROMISE_PATTERNS,
  PROMPT_LEAK_PATTERNS,
};
