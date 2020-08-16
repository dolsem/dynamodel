import 'reflect-metadata';
import type { SchemaAttributeDefinition } from 'dynamoose';
import type { Dynamodel } from '../dynamodel';
import type { DecoFactoryWithGet } from '../../types/decorators';
import type { Without } from '../../types/generic';

export const METADATA_KEY = Symbol('app-model/attribute');

type SADWithoutType<A, B> = Without<SchemaAttributeDefinition<A, B>, 'type'>;
export interface TypedAttributeDefinition<A, B> extends SADWithoutType<A, B> {
  type?: SchemaAttributeDefinition<A, B>['type'];
  shared?: boolean;
  list?: any;
}

export type AttributeDefinition =
  | TypedAttributeDefinition<NumberConstructor, number>
  | TypedAttributeDefinition<[NumberConstructor], number[]>
  | TypedAttributeDefinition<DateConstructor, Date>
  | TypedAttributeDefinition<StringConstructor, string>
  | TypedAttributeDefinition<[StringConstructor], string[]>
  // eslint-disable-next-line @typescript-eslint/ban-types
  | TypedAttributeDefinition<ObjectConstructor, Object>
  | TypedAttributeDefinition<ArrayConstructor, Array<any>>
  | TypedAttributeDefinition<any, any>;

export type AttributeDecorator = (
  target: typeof Dynamodel.prototype,
  propertyKey: string
) => void;

export const Attribute: DecoFactoryWithGet<
  AttributeDecorator,
  (
    definition?: AttributeDefinition
  ) => AttributeDefinition & { type: any; keys?: string[] }
> = (definition = {}) => (target, propertyKey) => {
  const cls = target.constructor;
  if (!definition.type) {
    definition.type = Reflect.getMetadata('design:type', target, propertyKey);
  }

  const attributeName =
    (cls as any).getAttributeName?.(propertyKey, definition) ?? propertyKey;

  if (!cls.attributes) cls.attributes = [];
  cls.attributes.push(attributeName);
  Reflect.defineMetadata(METADATA_KEY, definition, target, attributeName);
  if (attributeName !== propertyKey) {
    Reflect.defineMetadata(METADATA_KEY, definition, target, propertyKey);
  }
};

Attribute.get = (target, propertyKey) =>
  Reflect.getMetadata(METADATA_KEY, target, propertyKey);
