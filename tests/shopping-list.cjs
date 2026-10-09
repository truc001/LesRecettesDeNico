const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildShoppingList } = require('./load-ts.cjs')('lib/shopping-list.ts');
const list = (...recipes) => buildShoppingList(recipes.map((ingredients, index) => ({ title: 'Recette ' + (index + 1), ingredients })));
const labels = result => result.items.map(item => item.label);

test('adds the same ingredient across recipes', () => {
 const result = list('100 g de farine\n2 œufs', '150 g de farine', '50 g de farine\n1 œuf');
 assert.deepEqual(labels(result), ['300 g de farine', '3 œufs']);
 assert.deepEqual(result.items[0].recipes, ['Recette 1', 'Recette 2', 'Recette 3']);
});

test('converts units of the same family before adding', () => {
 assert.deepEqual(labels(list('800 g de farine\n50 cl de lait', '1,2 kg de farine\n1 litre de lait\n200 ml de lait')), ['2 kg de farine', '1,7 l de lait']);
});

test('keeps incompatible units side by side', () => {
 assert.deepEqual(labels(list('250 g de farine', '3 pots de farine')), ['250 g + 3 pots de farine']);
 assert.deepEqual(labels(list('800 g de tomates', '4 tomates')), ['800 g de tomates + 4 tomates']);
});

test('adds fractions and spoon or packet units', () => {
 assert.deepEqual(labels(list('1/2 sachet de levure chimique\n1 cuillère à soupe d’huile d’olive', '1 sachet de levure chimique\n3 cuillères à soupe d’huile d’olive\n1/2 citron', '1/2 citron')), ['1 citron', '4 cuillères à soupe d’huile d’olive', '1,5 sachet de levure chimique']);
});

test('ignores preparation, size, notes and number when matching names', () => {
 assert.deepEqual(labels(list('50 g de beurre fondu\n1 petit oignon\n3 œufs (pesez-les avec leur coquille)', '30 g de beurre froid\n2 gros oignons\n1 Œuf pour la pâte\n20 cl de lait ou de boisson végétale', '25 cl de lait entier')), ['80 g de beurre', '45 cl de lait', '4 œufs', '3 oignons']);
});

test('pluralizes a count that only appeared in the singular', () => {
 assert.deepEqual(labels(list('1 oignon\n1 citron vert', '1 oignon\n1 citron vert', '1 pomme de terre', '1 pomme de terre')), ['2 citrons verts', '2 oignons', '2 pommes de terre']);
});

test('adds teaspoons and tablespoons together, whatever their spelling', () => {
 assert.deepEqual(labels(list('1 cuillère à café de cumin\n2 c. à soupe de miel', '2 cuillères à café de cumin\n1 cuillère à soupe de miel', '1 cuillère à soupe de cumin\n1 c. à café de cannelle\n1 cuillère à café de cannelle')), ['2 cuillères à café de cannelle', '2 cuillères à soupe de cumin', '3 cuillères à soupe de miel']);
 assert.deepEqual(labels(list('2 cuillères à soupe de paprika', '1 cuillère à café de paprika')), ['2 cuillères à soupe + 1 cuillère à café de paprika']);
});

test('writes the name as it should be bought', () => {
 assert.deepEqual(labels(list('300 g de carottes râpées\n1 boîte de haricots rouges (250 g égouttés)\n1 poulet fermier d’environ 1,5 kg\n400 g de riz cuit et refroidi', '2 carottes\n20 cl d’huile')), ['300 g de carottes + 2 carottes', '1 boîte de haricots rouges', '20 cl d’huile', '1 poulet fermier', '400 g de riz cuit et refroidi']);
});

test('lists unquantified ingredients once, unless they already have a quantity', () => {
 const result = list('Sel, poivre\n1 pincée de noix de muscade\n10 g de sucre', 'Sel, poivre, piment d’Espelette\nUn peu de sucre\nPour servir : riz basmati et coriandre fraîche');
 assert.deepEqual(labels(result), ['10 g de sucre']);
 assert.deepEqual(result.extras.map(item => item.label), ['Coriandre fraîche', 'Noix de muscade', 'Piment d’Espelette', 'Poivre', 'Riz basmati', 'Sel']);
});

test('reads quantities given after a heading and leaves water out', () => {
 assert.deepEqual(labels(list('Pour le caramel : 100 g de sucre et 2 cuillères à soupe d’eau\n80 g de sucre\n1 litre d’eau\nGlaçons')), ['180 g de sucre']);
});
