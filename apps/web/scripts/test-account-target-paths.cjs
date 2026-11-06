const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/account-target.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { calculatorAccountPath, radarAccountPath, requiredAccountId } = loaded.exports;

test('selected users have distinct admin endpoints; neither falls back to /me', () => {
  assert.equal(calculatorAccountPath('customer-a'), '/calculator/users/customer-a');
  assert.equal(calculatorAccountPath('customer-b'), '/calculator/users/customer-b');
  assert.equal(radarAccountPath('customer-b'), '/lot-radar/admin/users/customer-b');
});

test('only an omitted calculator target means the signed-in account', () => {
  assert.equal(calculatorAccountPath(), '/calculator/me');
  for (const value of ['', ' ', '\t', null]) {
    assert.throws(() => calculatorAccountPath(value), /istifadəçi seçilməyib/);
    assert.throws(() => radarAccountPath(value), /istifadəçi seçilməyib/);
  }
  assert.throws(() => radarAccountPath(undefined), /istifadəçi seçilməyib/);
});

test('target ids are trimmed and encoded as one path segment', () => {
  assert.equal(requiredAccountId(' customer-a '), 'customer-a');
  assert.equal(calculatorAccountPath('a/b?c'), '/calculator/users/a%2Fb%3Fc');
});
