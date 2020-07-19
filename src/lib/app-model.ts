/* Copyright (C) Venu Entertainment Inc. - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 */

import * as _ from 'lodash';
import type { ModelConstructor, SchemaOptions } from 'dynamoose';
import * as dynamoose from 'dynamoose';

import { SubclassOnly, NoValue } from ':decorators';
import { Attribute, KeyAttribute, PrimaryKey, SecondaryKey, Table } from ':decorators/app-model';
import type { AttributeDefinition } from ':decorators/app-model/attribute.decorator';
import { Serializable, Attributes } from ':const/types';
import { TableDefinition } from ':decorators/app-model/table.decorator';

export const ASSOCIATED_APP_MODELS = Symbol('associated-app-models');
export const MARKED_KEYS = Symbol('marked-keys');

export const __timestamps = Symbol('app-model/timestamps');
export type ModelClass<T extends SchemaOptions['timestamps']|void = void> = (
  T extends void ? { new(): AppModel&{ [__timestamps]: Array<string> } } :
  T extends true ? { new(): AppModel&{ createdAt: Date, updatedAt: Date, [__timestamps]: ['createdAt', 'updatedAt'] } } :
  T extends { createdAt: string, updatedAt: string } ? (
    { new(): AppModel&(
      string extends T['createdAt'] ? {} : { [k in T['createdAt']]: Date }&(
        string extends T['updatedAt'] ? {} : { [k in T['updatedAt']]: Date }
      )
    )&(
      string extends T['createdAt']
        ? string extends T['updatedAt'] ? { [__timestamps]: [] } : { [__timestamps]: T['updatedAt'] }
        : string extends T['updatedAt'] ? { [__timestamps]: T['createdAt'] } : { [__timestamps]: [T['createdAt'], T['updatedAt']] }
    ) }
  ) : { new(): AppModel&{ [__timestamps]: [] } }
)&Omit<typeof AppModel, ''>

export type ModelAttributes<T extends ModelClass> = Omit<Attributes<InstanceType<T>>, InstanceType<T>[typeof __timestamps][number]|typeof __timestamps>;

export abstract class AppModel {
  ['constructor']!: typeof AppModel;

  static attributes: string[];
  static keys: string[];

  static tableModel: ModelConstructor<any, any>;

  /**
   * A hack in order to explicitly define TS types for key objects.
   * Hopefully it will be possible to set the type using model decorators, once there's better
   * decorator support in TypeScript.
   */
  @NoValue static pkam: { [attributeName: string]: any };
  @NoValue static skam: { [attributeName: string]: any };

  @SubclassOnly
  static getAttributeOptions(attributeName: string) {
    return Attribute.get(this.prototype, attributeName);
  }

  @SubclassOnly
  static getPropertyType(propertyName: string): new () => any {
    return Reflect.getMetadata('design:type', this.prototype, propertyName);
  }

  static getTableOptions<T extends AppModel, C extends ModelClass>(this: C&(new(data: object) => T)): TableDefinition;
  static getTableOptions(this: typeof AppModel, tableModel: typeof AppModel['tableModel']): TableDefinition;
  static getTableOptions(tableModel?: typeof AppModel['tableModel']) {
    if (!tableModel) return Table.get(this);
    return Table.get(Object.values(tableModel[ASSOCIATED_APP_MODELS])[0] as typeof AppModel);
  }

  @SubclassOnly
  static getAttributeName(propertyName: string, definition?: AttributeDefinition) {
    if (typeof definition === 'undefined') definition = Attribute.get(this.prototype, propertyName);
    if (!definition || definition.shared) return propertyName;
    return `${_.snakeCase(this.name)}:${propertyName}`;
  }

  @SubclassOnly
  static getPropertyName(attributeName: string, definition?: AttributeDefinition) {
    if (typeof definition === 'undefined') definition = Attribute.get(this.prototype, attributeName);
    if (!definition) return;
    if (definition.shared) return attributeName;
    return attributeName.substr(attributeName.indexOf(':') + 1);
  }

  static async get<T extends AppModel, C extends ModelClass>(this: C&(new(data: object) => T), key: C['pkam']&C['skam']): Promise<T> {
    const self = this as unknown as T['constructor']; // TODO: These shenanigans can be avoided once this gets implemented - https://github.com/Microsoft/TypeScript/issues/29261
    self.assertTableSet();
    const [pk] = self.stringifyKey(key, PrimaryKey);
    const [sk] = self.stringifyKey(key, SecondaryKey);
    const tableKey = { [PrimaryKey.name]: pk };
    if (sk) tableKey[SecondaryKey.name] = sk;

    const tableItem = await this.tableModel.get(tableKey);
    return self.fromTableItem(tableItem);
  }

  static async create<T extends AppModel, C extends ModelClass>(this: C&(new(data: object) => T), obj: ModelAttributes<C>): Promise<T> {
    const self = this as unknown as (new(data: object) => T)&typeof AppModel;
    return self.store(obj, 'create');
  }

  static async put<T extends AppModel, C extends ModelClass>(this: C&(new(data: object) => T), obj: Attributes<T>): Promise<T> {
    const self = this as unknown as (new(data: object) => T)&typeof AppModel;
    return self.store(obj, 'put');
  }

  static query(tableModel: typeof AppModel['tableModel'], query: any) {
    return tableModel.query(query);
  }

  static async execQuery<C extends (typeof AppModel)|ModelClass, T extends C['prototype']>(
    this: C,
    query: ReturnType<C['query']>
  ): Promise<Array<T>> {
    const self = this as typeof AppModel;
    const results = await query.exec();
    return results.map(item => self.fromTableItem(item, query['Model']));
  }

  static async delete<T extends AppModel, C extends ModelClass>(this: C&(new(data: object) => T), key: C['pkam']&C['skam']) {
    const self = this as unknown as (new(data: object) => T)&typeof AppModel;
    self.assertTableSet();
    const pk = self.stringifyKey(key, PrimaryKey);
    const sk = self.stringifyKey(key, SecondaryKey);
    const tableKey = { [PrimaryKey.name]: pk };
    if (sk) tableKey[SecondaryKey.name] = sk;

    await this.tableModel.delete(tableKey);
  }

  constructor(data: { [property: string] : any }) {
    Object.assign(this, data);
  }

  async save<T extends AppModel, C extends (typeof AppModel)&(new(data: object) => T)>(this: C['prototype']) {
    await this.constructor.store(this, 'put');
  }

  static verify<C extends ModelClass>(this: C) {
    this.attributes.forEach((attributeName) => {
      const options = this.getAttributeOptions(attributeName);
      if (options.keys) {
        if (options.type === 'list') {
          const { list } = options as any;
          if (!(list instanceof Array) || list.length !== 1 || list[0] !== String) {
            throw new Error(`[AppModel-${this.name}] ${this.getPropertyName(attributeName, options)} must be defined as 'list: [string]' to be used as a key attribute`);
          }
          if (!options.keys.some(key => key === PrimaryKey.name || key === SecondaryKey.name)) {
            throw new Error(`[AppModel-${this.name}] ${this.getPropertyName(attributeName, options)} must be part of the primary or the secondary key to be used as a key attribute`)
          }
        }
      }
    })
  }

  protected static assertTableSet() {
    if (!this.tableModel) {
      const error = new Error(`[AppModel-${this.name}] `);
      const caller = error.stack.split('\n')[2].match(/\.(.*)(?= \()/)[1];
      error.message += caller + '() failed - tableModel not set';
      throw error;
    }
  }

  protected static async store<T extends AppModel, C extends typeof AppModel>(
    this: C&(new(data: object) => T),
    obj: Record<string, any>,
    method: 'create'|'put'
  ): Promise<any> {
    const data = Object.keys(obj).reduce(
      (data, property) => {
        const definition = Attribute.get(this.prototype, property);
        if (definition) {
          const attribute = this.getAttributeName(property, definition);
          data[attribute] = obj[property];
        }
        return data;
      },
      {}
    );
    
    const items = this.stringifyKey(obj, PrimaryKey).flatMap((pk) => this.stringifyKey(obj, SecondaryKey).map((sk) => {
      const tableItem = { ...data };
      tableItem[PrimaryKey.name] = pk;
      if (sk) tableItem[SecondaryKey.name] = sk;
      return tableItem;
    }));
    // TODO: handle case when more than 25 items (max batch size)

    await dynamoose.transaction(items.map(item => this.tableModel.transaction[method](item)));
    return this.fromTableItem(items[0]);
    // return this.fromTableItem(await this.tableModel[method](tableItem));
  }

  protected static stringifyKey(key: { [property: string]: Serializable }, deco: ReturnType<typeof KeyAttribute>) {
    const { sequence, labels } = deco.get(this.prototype);
    return sequence.reduce((acc, label) => {
      const property = labels.get(label) || label
      if (!Object.prototype.hasOwnProperty.call(key, property)) {
        throw new Error(`[${this.name}::stringifyKey] required property '${property}' is missing on ${JSON.stringify(key)}`);
      }
      const { set, list } = this.getAttributeOptions(property);
      
      return acc.flatMap(s => (list ? key[property] as Array<Serializable> : [key[property]]).map((value) => {
        if (set) value = (set as any)(value);
        if (value instanceof Date) value = value.getTime();
        else if (typeof value !== 'number') value = this.escape(value.toString(), s => `\\${s}`);
        
        return s + `${label}{${value}}`;
      }));
    }, deco.includeModel ? [`${_.snakeCase(this.name)}:`] : ['']);
  }

  protected static parseKey<T extends AppModel, C extends (typeof AppModel)&(new(data: object) => T)>(
    this: C,
    key: string,
    deco: ReturnType<typeof KeyAttribute>,
  ): [{}, C];
  protected static parseKey(
    this: typeof AppModel,
    key: string,
    deco: ReturnType<typeof KeyAttribute>,
    tableModel: typeof AppModel['tableModel']
  ): [{}, (typeof AppModel)&(new(data: object) => AppModel)];
  protected static parseKey<T extends AppModel, C extends (typeof AppModel)&(new(data: object) => T)>(
    this: typeof AppModel|C,
    key: string,
    deco: ReturnType<typeof KeyAttribute>,
    tableModel?: typeof AppModel['tableModel'],
  ): [{}, C] {
    const parts = key.split(/(?<=^\w+):/);
    const tokens = parts.pop().split(/(?<!\\)[{}]/);
    const model = parts[0];

    let Model: C&(new(data: object) => T);
    if (this !== AppModel) {
      if (model && _.snakeCase(this.name) !== model) {
        throw new Error(); // TODO
      }
      Model = this as typeof Model;
    } else {
      if (!model) throw new Error(); // TODO
      Model = tableModel[ASSOCIATED_APP_MODELS][model];
    }

    const { labels } = deco.get(Model.prototype);
    const obj = tokens.filter((_, i) => i % 2 === 0).reduce((acc, label, i) => {
      if (label) {
        const property = labels.get(label) || label;
        const { list } = Model.getAttributeOptions(property);
        if (list) return acc;

        let value: any = Model.unescape(tokens[i*2+1], s => s[1]);
        const { get } = Model.getAttributeOptions(property);
        if (get) value = (get as any)(value);
        else {
          const type = Model.getPropertyType(property);
          switch (type) {
            case Date:
              value = new Date(value);
              break;
            case Boolean:
              value = value !== 'false';
              break;
            case Number:
              value = Number(value);
          }
        }
        acc[property] = value;
      }
      return acc;
    }, {});
    return [obj, Model];
  }

  protected static fromTableItem<T extends AppModel, C extends typeof AppModel>(this: typeof AppModel|(C&(new(data: object) => T)), tableItem: any);
  protected static fromTableItem(this: typeof AppModel, tableItem: any, tableModel: typeof AppModel['tableModel']);
  protected static fromTableItem<T extends AppModel, C extends typeof AppModel>(
    this: typeof AppModel|(C&(new(data: object) => T)),
    tableItem: any,
    tableModel?: typeof AppModel['tableModel']
  ) {
    if (!tableItem) return tableItem;

    const { schema } = AppModel.getTableOptions.apply(this, tableModel ? [tableModel] : []);
    let timestamps: string[];
    if (schema.timestamps) {
      if (typeof schema.timestamps === 'object') {
        timestamps = Object.values(schema.timestamps);
      } else {
        timestamps = ['createdAt', 'updatedAt']
      }
    }

    const attributes = Object.keys(tableItem);
    let data: {};
    let Model: (typeof AppModel)&(new(data: object) => AppModel);
    if (this !== AppModel) {
      data = {};
      Model = this as typeof Model;
    }
    else {
      const keyIndex = attributes.findIndex(v => tableModel[MARKED_KEYS].includes(v));
      const [key] = attributes.splice(keyIndex, 1);
      ([data, Model] = (this as typeof AppModel).parseKey(tableItem[key], KeyAttribute(key), tableModel));
    }
    
    attributes.forEach((key) => {
      if (Model.keys.includes(key)) {
        const [props] = Model.parseKey(tableItem[key], KeyAttribute(key));
        Object.assign(data, props);
      }
      else if (timestamps && timestamps.includes(key)) data[key] = tableItem[key];
      else {
        const property = Model.getPropertyName(key);
        data[property] = tableItem[key];
      }
      return data;
    });

    return new Model(data);
  }

  private static escape = RegExp.prototype[Symbol.replace].bind(/[{}]/g);
  private static unescape = RegExp.prototype[Symbol.replace].bind(/\\[{}]/g);
}
