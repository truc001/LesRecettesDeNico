const { test } = require('node:test');
const assert = require('node:assert/strict');
const { durationMinutes, groupOf, matchesFilters, featuredFirst } = require('./load-ts.cjs')('lib/recipe-browse.ts');
const recipe = extra => ({ id: 'r', title: 'Tarte aux pommes', category: 'Pâtisserie', description: 'Une tarte', duration: '1 h', servings: '8 parts', emoji: 'x', ingredients: '5 pommes\n1 pâte brisée', steps: 'Cuire', ...extra });
const none = { group: '', time: '', query: '', tag: '' };

test('reads active cooking time and ignores resting time', () => {
 assert.equal(durationMinutes('25 min'), 25);
 assert.equal(durationMinutes('1 h'), 60);
 assert.equal(durationMinutes('1 h 05 min'), 65);
 assert.equal(durationMinutes('3 h 30 min'), 210);
 assert.equal(durationMinutes('1 h 15'), 75);
 assert.equal(durationMinutes('20 min (plus 3 h au frais)'), 20);
 assert.equal(durationMinutes('À préciser'), null);
});

test('groups categories by moment, unknown ones apart', () => {
 assert.equal(groupOf({ category: 'Petit-déjeuner' }), 'petit-dejeuner');
 assert.equal(groupOf({ category: 'Dessert' }), 'desserts');
 assert.equal(groupOf({ category: 'pâtisserie' }), 'desserts');
 assert.equal(groupOf({ category: 'Pâte' }), 'autres');
});

test('filters by moment, time, tag and accent-insensitive search', () => {
 assert.equal(matchesFilters(recipe(), none), true);
 assert.equal(matchesFilters(recipe(), { ...none, group: 'desserts' }), true);
 assert.equal(matchesFilters(recipe(), { ...none, group: 'soir' }), false);
 assert.equal(matchesFilters(recipe(), { ...none, time: '60' }), true);
 assert.equal(matchesFilters(recipe(), { ...none, time: '30' }), false);
 assert.equal(matchesFilters(recipe({ duration: 'À préciser' }), { ...none, time: '60' }), false);
 assert.equal(matchesFilters(recipe({ tag: 'deNico' }), { ...none, tag: 'deNico' }), true);
 assert.equal(matchesFilters(recipe(), { ...none, tag: 'deNico' }), false);
 assert.equal(matchesFilters(recipe(), { ...none, query: 'PATE brisee' }), true);
 assert.equal(matchesFilters(recipe(), { ...none, query: 'chocolat' }), false);
});

test('puts the featured recipes first without reordering the rest', () => {
 assert.deepEqual(featuredFirst([{ id: 1 }, { id: 2, featured: true }, { id: 3 }]).map(r => r.id), [2, 1, 3]);
});
