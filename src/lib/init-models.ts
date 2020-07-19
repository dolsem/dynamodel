import * as _ from 'lodash';
import * as _dynamoose from 'dynamoose';

import type { TableDefinition } from ':decorators/app-model/table.decorator';
import { KeyAttribute } from ':decorators/app-model';
import { ASSOCIATED_APP_MODELS, MARKED_KEYS, ModelClass } from './app-model';

export const initModels = (appModels: Array<ModelClass>, { dynamoose = _dynamoose } = {}) => {
  const tableModels: {
    [tableName: string]: TableDefinition&{
      attributes: {
        [attributeName: string]: ReturnType<typeof appModels[number]['getAttributeOptions']>
      },
      appModels: typeof appModels,
    }
  } = {};

  appModels.forEach((appModel) => {
    appModel.verify();
    const tableOptions = appModel.getTableOptions();
    if (!tableModels[tableOptions.name]) {
      tableModels[tableOptions.name] = { ...tableOptions, attributes: {}, appModels: [] };
    }
    const { attributes, appModels } = tableModels[tableOptions.name];
    appModels.push(appModel);

    appModel.keys.forEach((keyName) => {
      attributes[keyName] = {
        type: String,
      };
      if (keyName === 'PK') attributes[keyName].hashKey = true;
      else if (keyName === 'SK') attributes[keyName].rangeKey = true;
    });
    appModel.attributes.forEach((attributeName) => {
      attributes[attributeName] = appModel.getAttributeOptions(attributeName);
    });
  });

  const modelStore = Object.entries(tableModels).reduce((acc, [key, { attributes, appModels, name, schema: schemaOpts, ...config }]) => {
    const schema = new dynamoose.Schema(attributes, schemaOpts);
    const tableModel = dynamoose.model(name, schema, config);
    const markedKeys = [];
    tableModel[ASSOCIATED_APP_MODELS] = Object.create(null);
    tableModel[MARKED_KEYS] = markedKeys;
    appModels.forEach((appModel) => {
      tableModel[ASSOCIATED_APP_MODELS][_.snakeCase(appModel.name)] = appModel;
      appModel.keys.forEach(key => !markedKeys.includes(key) && KeyAttribute(key).includeModel && markedKeys.push(key)); 
      appModel.tableModel = tableModel;
    });
  
    acc[key] = tableModel;
    return acc;
  }, {});

  return modelStore;
}
