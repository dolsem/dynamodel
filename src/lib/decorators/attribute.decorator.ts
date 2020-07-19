/* Copyright (C) Venu Entertainment Inc. - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import type { SchemaAttributeDefinition } from 'dynamoose';
import type { AppModel } from ':modules/core/database/app-model';
import { DecoFactoryWithGet, Without } from ':const/types'; 

const METADATA_KEY = Symbol('app-model/attribute');

export interface TypedAttributeDefinition<A, B> extends Without<SchemaAttributeDefinition<A, B>, 'type'> {
  type?: SchemaAttributeDefinition<A, B>['type'];
  shared?: boolean;
  list?: any;
};

export type AttributeDefinition =
| TypedAttributeDefinition<NumberConstructor, number>
| TypedAttributeDefinition<[NumberConstructor], number[]>
| TypedAttributeDefinition<DateConstructor, Date>
| TypedAttributeDefinition<StringConstructor, string>
| TypedAttributeDefinition<[StringConstructor], string[]>
| TypedAttributeDefinition<ObjectConstructor, Object>
| TypedAttributeDefinition<ArrayConstructor, Array<any>>
| TypedAttributeDefinition<any, any>

export type AttributeDecorator = (target: typeof AppModel.prototype, propertyKey: string) => void
export const Attribute: DecoFactoryWithGet<AttributeDecorator, (definition?: AttributeDefinition) => AttributeDefinition&{ type: any, keys?: string[] }> =
  (definition = {}) => (target, propertyKey) => {
    const cls = target.constructor;
    if (!definition.type) definition.type = Reflect.getMetadata('design:type', target, propertyKey)

    const attributeName = cls.getAttributeName?.(propertyKey, definition) ?? propertyKey;

    if (!cls.attributes) cls.attributes = [];
    cls.attributes.push(attributeName);
    Reflect.defineMetadata(METADATA_KEY, definition, target, attributeName);
    if (attributeName !== propertyKey) {
      Reflect.defineMetadata(METADATA_KEY, definition, target, propertyKey);
    }
  }

Attribute.get = (target, propertyKey) => Reflect.getMetadata(METADATA_KEY, target, propertyKey);