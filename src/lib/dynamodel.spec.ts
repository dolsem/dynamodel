import test from 'ava';
import { Compiler, expecter } from 'ts-snippet/ava';

const compiler = new Compiler({ target: 'es2019' }, __dirname);
const expectSnippet = expecter(s => `import { Dynamodel } from './dynamodel';${s}`, compiler);

test('TS forbids static model method calls on Dynamodel class', t => {
  const err = /Cannot assign an abstract constructor type to a non-abstract constructor type/;
  expectSnippet(t, 'Dynamodel.get({})').toFail(err);
  expectSnippet(t, 'Dynamodel.make({})').toFail(err);
  expectSnippet(t, 'Dynamodel.create({})').toFail(err);
  expectSnippet(t, 'Dynamodel.put({})').toFail(err);
});
