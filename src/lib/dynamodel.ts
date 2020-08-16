import 'reflect-metadata';
import type { SchemaOptions } from 'dynamoose';
import * as dynamoose from 'dynamoose';
import snakeCase from 'lodash/snakeCase';

import type { Attributes } from '../types/model';
import type { Serializable } from '../types/generic';
import {
  Attribute,
  KeyAttribute,
  PrimaryKey,
  SecondaryKey,
  Table,
  AttributeDefinition,
  NoValue,
} from './decorators';
import type { TableInstance, TableDeco } from './decorators/table.decorator';

export const TABLE_INSTANCE = Symbol('app-model/table-instance');

export const __timestamps = Symbol('app-model/timestamps');
export type ModelClass<
  T extends SchemaOptions['timestamps'] | void = void
> = (
  T extends void ? { new(): Dynamodel&{ [__timestamps]: Array<string> } } :
  T extends true ? { new(): Dynamodel&{ createdAt: Date, updatedAt: Date, [__timestamps]: ['createdAt', 'updatedAt'] } } :
  T extends { createdAt: string, updatedAt: string } ? (
    { new(): Dynamodel&(
      string extends T['createdAt'] ? void : { [k in T['createdAt']]: Date }&(
        string extends T['updatedAt'] ? void : { [k in T['updatedAt']]: Date }
      )
    )&(
      string extends T['createdAt']
        ? string extends T['updatedAt'] ? { [__timestamps]: [] } : { [__timestamps]: T['updatedAt'] }
        : string extends T['updatedAt'] ? { [__timestamps]: T['createdAt'] } : { [__timestamps]: [T['createdAt'], T['updatedAt']] }
    ) }
  ) : { new(): Dynamodel&{ [__timestamps]: [] } }
) & Omit<typeof Dynamodel, ''>;

export type ConstructableModelClass<
  C extends ModelClass = ModelClass,
  T extends Dynamodel = Dynamodel,
> = C & (new (data: Record<string, unknown>) => T);

export type ModelAttributes<T extends ModelClass> = Omit<
  Attributes<InstanceType<T>>,
  InstanceType<T>[typeof __timestamps][number]|typeof __timestamps
>;

export abstract class Dynamodel {
  ['constructor']!: typeof Dynamodel;

  static attributes: string[];
  static keys: string[];
  // static tableInstance: ModelConstructor<any, any>;

  /**
   * A hack in order to explicitly define TS types for key objects.
   * Hopefully it will be possible to set the type using model decorators, once there's better
   * decorator support in TypeScript.
   */
  @NoValue static pkam: { [attributeName: string]: any };
  @NoValue static skam: { [attributeName: string]: any };

  static getAttributeOptions(
    this: ConstructableModelClass,
    attributeName: string
  ): ReturnType<typeof Attribute.get> {
    return Attribute.get(this.prototype, attributeName);
  }

  static getPropertyType(this: ConstructableModelClass, propertyName: string): new () => any {
    return Reflect.getMetadata('design:type', this.prototype, propertyName);
  }

  static getTable(this: ConstructableModelClass): TableDeco {
    return Table.get(this);
  }

  static getAttributeName(
    this: ConstructableModelClass,
    propertyName: string,
    definition?: AttributeDefinition
  ): string {
    if (typeof definition === 'undefined') {
      definition = Attribute.get(this.prototype, propertyName);
    }
    if (!definition || definition.shared) return propertyName;
    return `${snakeCase(this.name)}:${propertyName}`;
  }

  static getPropertyName(
    this: ConstructableModelClass,
    attributeName: string,
    definition?: AttributeDefinition
  ): string {
    if (typeof definition === 'undefined') definition = Attribute.get(this.prototype, attributeName);
    if (!definition) return undefined;
    if (definition.shared) return attributeName;
    return attributeName.substr(attributeName.indexOf(':') + 1);
  }

  static async get<T extends Dynamodel, C extends ModelClass>(
    this: ConstructableModelClass<C, T>,
    key: C['pkam'] & C['skam']
  ): Promise<T> {
    const self = this as unknown as ConstructableModelClass&typeof Dynamodel; // TODO: These shenanigans can be avoided once this gets implemented - https://github.com/Microsoft/TypeScript/issues/29261
    const tableInstance = self.getTableInstanceOrFail();
    const [pk] = self.stringifyKey(key, PrimaryKey);
    const [sk] = self.stringifyKey(key, SecondaryKey);
    const tableKey = { [PrimaryKey.name]: pk };
    if (sk) tableKey[SecondaryKey.name] = sk;

    const tableItem = await tableInstance.get(tableKey);
    return self.fromTableItem(tableItem);
  }

  static make<T extends Dynamodel, C extends ModelClass>(
    this: ConstructableModelClass<C, T>,
    obj: ModelAttributes<C>
  ): T {
    return new this(obj);
  }

  static async create<T extends Dynamodel, C extends ModelClass>(
    this: ConstructableModelClass<C, T>,
    obj: ModelAttributes<C>
  ): Promise<T> {
    const self = this as unknown as ConstructableModelClass&typeof Dynamodel;
    return self.store(obj, 'create');
  }

  static async put<T extends Dynamodel, C extends ModelClass>(
    this: ConstructableModelClass<C, T>,
    obj: ModelAttributes<C>
  ): Promise<T> {
    const self = this as unknown as ConstructableModelClass&typeof Dynamodel;
    return self.store(obj, 'put');
  }

  static query(tableInstance: TableInstance, query: any) {
    return tableInstance.query(query);
  }

  static async execQuery<C extends (typeof Dynamodel)|ModelClass, T extends C['prototype']>(
    this: C,
    query: ReturnType<C['query']>
  ): Promise<Array<T>> {
    const self = this as typeof Dynamodel;
    const results = await query.exec();
    return results.map(item => self.fromTableItem(item, query['Model']));
  }

  static async delete<T extends Dynamodel, C extends ModelClass>(
    this: ConstructableModelClass<C, T>,
    key: C['pkam'] & C['skam']
  ) {
    const self = this as unknown as ConstructableModelClass&typeof Dynamodel;
    const tableInstance = self.getTableInstanceOrFail();
    const pk = self.stringifyKey(key, PrimaryKey);
    const sk = self.stringifyKey(key, SecondaryKey);
    const tableKey = { [PrimaryKey.name]: pk };
    if (sk) tableKey[SecondaryKey.name] = sk;

    await tableInstance.delete(tableKey);
  }

  constructor(data?: Record<string, any>) {
    Object.assign(this, data);
  }

  async save(this: (typeof Dynamodel&ConstructableModelClass)['prototype']): Promise<void> {
    await this.constructor.store(this, 'put');
  }

  static verify<C extends ModelClass>(this: C) {
    this.attributes.forEach((attributeName) => {
      const options = this.getAttributeOptions(attributeName);
      if (options.keys) {
        if (options.type === 'list') {
          const { list } = options as any;
          if (!(list instanceof Array) || list.length !== 1 || list[0] !== String) {
            throw new Error(`[Dynamodel-${this.name}] ${this.getPropertyName(attributeName, options)} must be defined as 'list: [string]' to be used as a key attribute`);
          }
          if (!options.keys.some(key => key === PrimaryKey.name || key === SecondaryKey.name)) {
            throw new Error(`[Dynamodel-${this.name}] ${this.getPropertyName(attributeName, options)} must be part of the primary or the secondary key to be used as a key attribute`);
          }
        }
      }
    })
  }

  protected static getTableInstanceOrFail(this: typeof Dynamodel&ConstructableModelClass): TableInstance {
    if (!this[TABLE_INSTANCE]) {
      const table = this.getTable();
      const instance = table?.getInstance?.();
      if (!instance) {
        const error = new Error(`[Dynamodel-${this.name}] `);
        const caller = error.stack.split('\n')[2].match(/\.(.*)(?= \()/)[1];
        error.message += caller + '() failed - table not initialized';
        throw error;
      }
      this[TABLE_INSTANCE] = instance;
    }
    return this[TABLE_INSTANCE];
  }

  protected static async store(
    this: (typeof Dynamodel) & ConstructableModelClass,
    obj: Record<string, any>,
    method: 'create'|'put'
  ): Promise<any> {
    const tableInstance = this.getTableInstanceOrFail();
    const data = Object.keys(obj).reduce((data, property) => {
      const definition = Attribute.get(this.prototype, property);
      if (definition) {
        const attribute = this.getAttributeName(property, definition);
        data[attribute] = obj[property];
      }
      return data;
    }, {});

    const items = this.stringifyKey(obj, PrimaryKey).flatMap((pk) => this.stringifyKey(obj, SecondaryKey).map((sk) => {
      const tableItem = { ...data };
      tableItem[PrimaryKey.name] = pk;
      if (sk) tableItem[SecondaryKey.name] = sk;
      return tableItem;
    }));
    // TODO: handle case when more than 25 items (max batch size)

    await dynamoose.transaction(items.map(item => tableInstance.transaction[method](item)));
    return this.fromTableItem(items[0]);
    // return this.fromTableItem(await this.tableModel[method](tableItem));
  }

  // TODO: reverse key and deco
  protected static stringifyKey(
    this: (typeof Dynamodel)&ConstructableModelClass,
    key: { [property: string]: Serializable },
    deco: ReturnType<typeof KeyAttribute>
  ): string[] {
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
    }, deco.includeModel ? [`${snakeCase(this.name)}:`] : ['']);
  }

  protected static parseKey<C extends typeof Dynamodel&ConstructableModelClass>(
    this: C,
    key: string,
    deco: ReturnType<typeof KeyAttribute>,
  ): [Record<string, unknown>, C];
  protected static parseKey(
    this: typeof Dynamodel,
    key: string,
    deco: ReturnType<typeof KeyAttribute>,
    tableDeco: TableDeco,
  ): [Record<string, unknown>, typeof Dynamodel&ConstructableModelClass];
  protected static parseKey<C extends typeof Dynamodel&ConstructableModelClass>(
    this: typeof Dynamodel|C,
    key: string,
    deco: ReturnType<typeof KeyAttribute>,
    tableDeco?: TableDeco,
  ): [Record<string, unknown>, C] {
    const parts = key.split(/(?<=^\w+):/);
    const tokens = parts.pop().split(/(?<!\\)[{}]/);
    const model = parts[0];

    let Model: C;
    if (this !== Dynamodel) {
      if (model && snakeCase(this.name) !== model) {
        throw new Error(); // TODO
      }
      Model = this as typeof Model;
    } else {
      if (!model) throw new Error(); // TODO
      Model = tableDeco.findModel(model) as C;
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

  protected static fromTableItem(this: typeof Dynamodel|ConstructableModelClass, tableItem: any);
  protected static fromTableItem(this: typeof Dynamodel, tableItem: any, tableDeco: TableDeco);
  protected static fromTableItem(
    this: typeof Dynamodel|ConstructableModelClass,
    tableItem: any,
    tableDeco?: TableDeco,
  ) {
    if (!tableItem) return tableItem;

    const { schema } = (tableDeco || Dynamodel.getTable.call(this)).getConfig();
    let timestamps: string[];
    if (schema.timestamps) {
      if (typeof schema.timestamps === 'object') {
        timestamps = Object.values(schema.timestamps);
      } else {
        timestamps = ['createdAt', 'updatedAt']
      }
    }

    const attributes = Object.keys(tableItem);
    let data: Record<string, unknown>;
    let Model: typeof Dynamodel&ConstructableModelClass;
    if (this !== Dynamodel) {
      data = {};
      Model = this as typeof Model;
    } else {
      const markedKeys = tableDeco.getMarkedKeys();
      const keyIndex = attributes.findIndex(v => markedKeys.includes(v));
      const [key] = attributes.splice(keyIndex, 1);
      ([data, Model] = (this as typeof Dynamodel).parseKey(tableItem[key], KeyAttribute(key), tableDeco));
    }

    attributes.forEach((key) => {
      if (Model.keys.includes(key)) {
        const [props] = Model.parseKey(tableItem[key], KeyAttribute(key));
        Object.assign(data, props);
      } else if (timestamps && timestamps.includes(key)) {
        data[key] = tableItem[key];
      } else {
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
