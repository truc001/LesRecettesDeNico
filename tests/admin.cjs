const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAdmin } = require('./load-ts.cjs')('lib/admin.ts');
const user = email => ({ email, uid: 'u', name: '', provider: 'google.com' });
test('only the administrator account is treated as such', () => {
 assert.equal(isAdmin(user('appcraft31@gmail.com')), true);
 assert.equal(isAdmin(user('someone@example.com')), false);
 assert.equal(isAdmin(null), false);
});
