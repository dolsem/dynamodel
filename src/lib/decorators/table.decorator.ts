import 'reflect-metadata';
import { snakeCase } from 'lodash';
import dynamoose from 'dynamoose';

import type { DecoFactoryWithGet } from '../../types/decorators';
import { Dynamodel, ModelClass, ConstructableModelClass } from '../dynamodel';
import { KeyAttribute } from './key-attribute.decorator';

const METADATA_KEY = Symbol('app-model/table');
const TABLE_INSTANCE = Symbol('app-model/table/table-instance');
const ASSOCIATED_MODELS = Symbol('app-model/table/associated-models');
const MARKED_KEYS = Symbol('app-model/table/marked-keys');

type Timestamps = dynamoose.SchemaOptions['timestamps'];
export interface TableDefinition<
  T extends Timestamps = Timestamps
> extends dynamoose.ModelOption {
  name: string;
  schema?: dynamoose.SchemaOptions&{ timestamps?: T };
}

export type TableInstance = dynamoose.ModelConstructor<any, any>;

export interface TableDeco<T extends Timestamps = false> {
  <M extends ConstructableModelClass<ModelClass<T>>>(target: M): void;
  // Model: ConstructableModelClass<ModelClass<T>>;
  Model: ModelClass<T>;
  init: () => TableInstance;
  getInstance: () => TableInstance;
  getConfig: () => TableDefinition;
  getMarkedKeys: () => string[];
  findModel: (name: string) => ConstructableModelClass<ModelClass<T>>;
}

export interface TableDecoFactory {
  <T extends Timestamps = false>(definition: TableDefinition<T>): TableDeco<T>;
  get<T extends Timestamps>(name: string): TableDeco<T>;
  get<T extends Timestamps>(target: Parameters<DecoFactoryWithGet<ClassDecorator>['get']>[0]): TableDeco<T>;
}

const tables = new Map<string, TableDeco>();
const tableDefinitions = new Map<string, TableDefinition>();
const tableModels = new Map<string, ConstructableModelClass[]>();

export const Table = ((config) => {
  const { name, schema: schemaOpts, ...tableOpts } = config;
  tableDefinitions.set(name, config);
  tableModels.set(name, []);

  const deco: TableDeco = (target) => {
    Reflect.defineMetadata(METADATA_KEY, name, target);
    tableModels.get(name).push(target);
  };
  deco.getConfig = () => tableDefinitions.get(name);
  tables.set(name, deco);

  let createdAt: ' ';
  let updatedAt: ' ';
  const timestamps = schemaOpts?.timestamps as Timestamps;
  if (typeof timestamps === 'object') {
    createdAt = timestamps.createdAt as ' ';
    updatedAt = timestamps.updatedAt as ' ';
  } else if (timestamps) {
    createdAt = 'createdAt' as ' ';
    updatedAt = 'updatedAt' as ' ';
  }

  deco.Model = (
    (!createdAt || !updatedAt)
      ? Dynamodel
      : class extends Dynamodel {
          [createdAt]: Date;
          [updatedAt]: Date;
        }
  ) as unknown as (typeof deco)['Model'];

  deco.init = () => {
    const attributes = {};
    const markedKeys = [];
    const modelsByName = Object.create(null);
    tableModels.get(name).forEach((model) => {
      model.verify();
      model.keys.forEach((keyName) => {
        attributes[keyName] = {
          type: String,
        };
        if (keyName === 'PK') attributes[keyName].hashKey = true;
        else if (keyName === 'SK') attributes[keyName].rangeKey = true;

        if (!markedKeys.includes(keyName) && KeyAttribute(keyName).includeModel) markedKeys.push(keyName);
      });
      model.attributes.forEach((attributeName) => {
        attributes[attributeName] = model.getAttributeOptions(attributeName);
      });
      modelsByName[snakeCase(model.name)] = model;
    });

    const schema = new dynamoose.Schema(attributes, schemaOpts);
    const tableInstance = dynamoose.model(name, schema, tableOpts);
    deco[TABLE_INSTANCE] = tableInstance;
    deco[ASSOCIATED_MODELS] = modelsByName;
    deco[MARKED_KEYS] = markedKeys;
  
    return tableInstance;
  };

  deco.getInstance = () => deco[TABLE_INSTANCE];
  deco.getMarkedKeys = () => deco[MARKED_KEYS];
  deco.findModel = name => deco[ASSOCIATED_MODELS][name];

  return deco;
}) as TableDecoFactory;

Table.get = target => {
  const name = typeof target === 'function' ? Reflect.getMetadata(METADATA_KEY, target) : target;
  return tables.get(name);
}
