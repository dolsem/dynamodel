import test from 'ava';
import * as _ from 'lodash';

import { ddb } from './setup';
import { Pets, Dog } from './fixtures';

test('DB operations throw error if table has not been created', async (t) => {
  const err = (method: string) => `[Dynamodel-Dog] ${method}() failed - table not initialized`;
  await Promise.all([
    t.throwsAsync(() => Dog.create({ name: 'Sparky', owner: 'Victor', breed: 'Bull Terrier' }), err('store')),
    t.throwsAsync(() => Dog.make({ name: 'Sparky', owner: 'Victor', breed: 'Bull Terrier' }).save(), err('store')),
    t.throwsAsync(() => Dog.delete({ name: 'Sparky', owner: 'Victor', breed: 'Bull Terrier' }), err('delete')),
    t.throwsAsync(() => Dog.get({ name: 'Sparky', owner: 'Victor', breed: 'Bull Terrier' }), err('get')),
  ]);
});

test('Table.init() creates table', async (t) => {
  await Pets.init().scan().exec();
  
  const { TableNames } = await ddb.listTables().promise();
  t.is(TableNames.length, 1);
  t.is(TableNames[0], 'Pets');

  const { Table } = await ddb.describeTable({ TableName: 'Pets' }).promise();
  const keys = _.chain(Table.KeySchema).keyBy('KeyType').mapValues('AttributeName').value();
  t.is(keys.HASH, 'PK');
  t.is(keys.RANGE, 'SK');
});
