import type { JsonSchema, JsonSchemaProperty } from "./types";

export type FieldType = "string" | "boolean" | "number";

export type SchemaField = {
  name: string;
  type: FieldType;
  required: boolean;
  label: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  inputType: "text" | "url" | "number" | "checkbox";
  defaultValue: unknown;
};

function propertyType(property: JsonSchemaProperty): FieldType {
  const raw = Array.isArray(property.type) ? property.type[0] : property.type;
  if (raw === "boolean" || raw === "number" || raw === "integer") {
    return raw === "integer" ? "number" : raw;
  }
  return "string";
}

export function fieldsFromSchema(schema: JsonSchema): SchemaField[] {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  return Object.entries(properties).map(([name, property]) => {
    const type = propertyType(property);
    return {
      name,
      type,
      required: required.has(name),
      label: property.title || name.replaceAll("_", " "),
      minLength: property.minLength,
      maxLength: property.maxLength,
      pattern: property.pattern,
      inputType:
        type === "boolean" ? "checkbox" : type === "number" ? "number" : property.format === "uri" ? "url" : "text",
      defaultValue: property.default ?? (type === "boolean" ? false : ""),
    };
  });
}

export function emptyValues(fields: SchemaField[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.name, field.defaultValue]));
}

export function coerceValues(
  fields: SchemaField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === "boolean") {
      next[field.name] = Boolean(value);
      continue;
    }
    if (field.type === "number") {
      if (value === "" || value === null || value === undefined) {
        if (!field.required) continue;
        next[field.name] = 0;
        continue;
      }
      next[field.name] = Number(value);
      continue;
    }
    const text = value == null ? "" : String(value);
    if (!text && !field.required) continue;
    next[field.name] = text;
  }
  return next;
}
