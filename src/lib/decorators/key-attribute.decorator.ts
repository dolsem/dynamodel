import 'reflect-metadata';
import type { DecoFactoryWithClassGet } from '../../types/decorators';
import { Attribute, AttributeDecorator } from './attribute.decorator';
export interface KeyAttributeMetadata {
  sequence: string[];
  labels: Map<string, string>;
}
export type KeyAttributeDecoratorFactory = {
  includeModel: boolean;
} & DecoFactoryWithClassGet<
  AttributeDecorator,
  (position?: number, label?: string) => KeyAttributeMetadata
>;

const definedDecorators = new Map<string, KeyAttributeDecoratorFactory>();
export const KeyAttribute = (keyAttributeName: string, includeModel = true) => {
  let decorator = definedDecorators.get(keyAttributeName);
  if (decorator) return decorator;

  const metadataPath = `app-model/key-attribute/${keyAttributeName}`;
  const decoratorGet: KeyAttributeDecoratorFactory['get'] = (target) => {
    return Reflect.getMetadata(metadataPath, target);
  };

  decorator = ((position = 0, label) => (target, propertyKey) => {
    if (position === 0) {
      const cls = target.constructor;
      if (!cls.keys) cls.keys = [];
      cls.keys.push(keyAttributeName);
    }

    let metadata = decoratorGet(target);
    if (!metadata) {
      metadata = { sequence: [], labels: new Map() };
      Reflect.defineMetadata(metadataPath, metadata, target);
    }
    metadata.sequence[position] = label || propertyKey;
    metadata.labels.set(label, propertyKey);

    const attrData = Attribute.get(target, propertyKey);
    if (!attrData) {
      throw new Error(
        `[KeyAttribute] property '${propertyKey}' must be decorated with @Attribute() first`
      );
    }
    if (!attrData.keys) attrData.keys = [];
    attrData.keys.push(keyAttributeName);
  }) as KeyAttributeDecoratorFactory;
  decorator.get = decoratorGet;
  decorator.includeModel = includeModel;
  Object.defineProperty(decorator, 'name', { value: keyAttributeName });

  definedDecorators.set(keyAttributeName, decorator);
  return decorator;
};
