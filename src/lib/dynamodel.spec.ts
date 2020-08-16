import test from 'ava';
import { Compiler, expecter } from 'ts-snippet/ava';

const compiler = new Compiler({ target: 'es2019' }, __dirname);
const expectSnippet = expecter(s => `import { Dynamodel } from './dynamodel';${s}`, compiler);

test('bla', t => {
  t.plan(1);
  expectSnippet(t, '[].flatMap').toSucceed();
});
