import { Schema } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { generateMongoJsonSchema, stableJson } from '../mongo/jsonSchema/generate.js';

describe('Mongoose-generated Mongo $jsonSchema', () => {
  it('generates deterministic validators from Mongoose schemas', () => {
    const schema = new Schema(
      {
        _id: { type: String, required: true },
        active: Boolean,
        createdAt: Date,
        name: { type: String, required: true },
        score: Number,
      },
      { strict: true, versionKey: false },
    );

    const first = generateMongoJsonSchema(schema);
    const second = generateMongoJsonSchema(schema);

    expect(stableJson(first)).toBe(stableJson(second));
    expect(first).toEqual({
      bsonType: 'object',
      additionalProperties: false,
      required: ['_id', 'name'],
      properties: {
        _id: { bsonType: 'string' },
        active: { bsonType: 'bool' },
        createdAt: { bsonType: 'date' },
        name: { bsonType: 'string' },
        score: { bsonType: ['double', 'int', 'long', 'decimal'] },
      },
    });
  });
});
