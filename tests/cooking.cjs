const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stepIngredients, stepMinutes } = require('./load-ts.cjs')('lib/cooking.ts');
const ingredients = ['120 g de chocolat noir', '100 g de beurre', '3 œufs', '80 g de sucre', '40 g de farine', 'Sel, poivre'];

test('finds the ingredients a step calls for', () => {
 assert.deepEqual(stepIngredients('Faites fondre le chocolat avec le beurre.', ingredients), ['120 g de chocolat noir', '100 g de beurre']);
 assert.deepEqual(stepIngredients('Fouettez les Œufs avec le sucre, puis ajoutez la farine.', ingredients), ['3 œufs', '80 g de sucre', '40 g de farine']);
 assert.deepEqual(stepIngredients('Préchauffez le four à 200 °C.', ingredients), []);
});

test('reads the waiting time of a step', () => {
 assert.equal(stepMinutes('Enfournez 9 à 10 minutes : le centre doit rester tremblotant.'), 9);
 assert.equal(stepMinutes('Laissez reposer 30 min au frais.'), 30);
 assert.equal(stepMinutes('Couvrez et laissez lever 1 h 30.'), 90);
 assert.equal(stepMinutes('Laissez mijoter 3 heures à feu très doux.'), 180);
 assert.equal(stepMinutes('Préchauffez le four à 200 °C.'), null);
});
