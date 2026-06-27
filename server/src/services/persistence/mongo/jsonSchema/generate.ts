import { Schema, type SchemaType } from 'mongoose';

export type JsonSchemaValue =
  | string
  | number
  | boolean
  | null
  | JsonSchemaValue[]
  | { [key: string]: JsonSchemaValue };

export interface MongoJsonSchema {
  bsonType: 'object';
  required?: string[];
  properties: Record<string, JsonSchemaValue>;
  additionalProperties: boolean;
}

function bsonTypeFor(path: SchemaType): JsonSchemaValue {
  switch (path.instance) {
    case 'String':
      return 'string';
    case 'Number':
      return ['double', 'int', 'long', 'decimal'];
    case 'Boolean':
      return 'bool';
    case 'Date':
      return 'date';
    case 'ObjectId':
      return 'objectId';
    case 'Array':
      return 'array';
    case 'Embedded':
    case 'Subdocument':
      return 'object';
    case 'Mixed':
      return {};
    default:
      return {};
  }
}

function addProperty(
  properties: Record<string, JsonSchemaValue>,
  dottedPath: string,
  value: JsonSchemaValue,
): void {
  const parts = dottedPath.split('.');
  const first = parts[0];
  if (!first) return;
  if (parts.length === 1) {
    properties[first] = value;
    return;
  }
  const current = properties[first];
  const nested =
    current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, JsonSchemaValue>)
      : { bsonType: 'object', properties: {}, additionalProperties: true };
  const nestedProps =
    nested.properties && typeof nested.properties === 'object' && !Array.isArray(nested.properties)
      ? (nested.properties as Record<string, JsonSchemaValue>)
      : {};
  addProperty(nestedProps, parts.slice(1).join('.'), value);
  nested.properties = nestedProps;
  properties[first] = nested;
}

export function generateMongoJsonSchema(schema: Schema): MongoJsonSchema {
  const required = new Set<string>();
  const properties: Record<string, JsonSchemaValue> = {};

  schema.eachPath((pathName, path) => {
    if (pathName === '__v') return;
    const options = path.options as { required?: boolean | unknown[] | (() => boolean) };
    if (options.required === true) {
      required.add(pathName.split('.')[0] ?? pathName);
    }
    const typeValue = bsonTypeFor(path);
    const property =
      typeof typeValue === 'object' && !Array.isArray(typeValue)
        ? typeValue
        : { bsonType: typeValue };
    addProperty(properties, pathName, property);
  });

  const out: MongoJsonSchema = {
    bsonType: 'object',
    properties,
    additionalProperties: schema.options.strict === true ? false : true,
  };
  if (required.size > 0) out.required = [...required].sort();
  return out;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortJson((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
