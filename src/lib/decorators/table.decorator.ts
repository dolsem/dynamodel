/* Copyright (C) Venu Entertainment Inc. - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import type { ModelOption, SchemaOptions } from 'dynamoose';
import { DecoFactoryWithGet, Without } from ':const/types'; 
import { AppModel, ModelClass } from ':modules/core/database/app-model';

const METADATA_KEY = Symbol('app-model/table');

export interface TableDefinition<T extends SchemaOptions['timestamps'] = SchemaOptions['timestamps']> extends ModelOption {
  name: string;
  schema?: SchemaOptions&{ timestamps?: T };
}

interface TableDeco {
  get: (...args: Parameters<DecoFactoryWithGet<ClassDecorator>['get']>) => TableDefinition;
  <T extends SchemaOptions['timestamps'] = false>(definition: TableDefinition<T>): ClassDecorator&{
    Model: ModelClass<T>,
  }
}

const tableDefinitions = new Map<string, TableDefinition<SchemaOptions['timestamps']>>();
export const Table = ((config) => {
  tableDefinitions.set(config.name, config);
  const deco: ReturnType<TableDeco> = (target) => {
    Reflect.defineMetadata(METADATA_KEY, config.name, target);
  }

  let createdAt: ' ';
  let updatedAt: ' ';
  const timestamps = config.schema?.timestamps as SchemaOptions['timestamps'];
  if (typeof timestamps === 'object') {
    createdAt = timestamps.createdAt as ' ';
    updatedAt = timestamps.updatedAt as ' ';
  } else if (timestamps) {
    createdAt = 'createdAt' as ' ';
    updatedAt = 'updatedAt' as ' ';
  }

  deco.Model = ((!createdAt || !updatedAt)
    ? AppModel
    : (
      class extends AppModel {
        [createdAt]: Date;
        [updatedAt]: Date;
      }
    )
  ) as any as (typeof deco)['Model'];
  
  return deco;
}) as TableDeco

Table.get = target => tableDefinitions.get(Reflect.getMetadata(METADATA_KEY, target));