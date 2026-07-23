import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLinks } from './link-classifier.js';
import { classifyMenuStructure } from './menu-discovery.js';

test('Google local reviews never become a menu through section context', async () => {
  const googleReviews = {
    url: 'https://www.google.com/search?tbm=lcl&rldimm=123#lkt=LocalPoiReviews',
    text: 'Google Reviews',
    section_heading: 'Menu',
  };

  const { classified } = await classifyLinks([googleReviews]);
  assert.equal(classified.menu_all.length, 0);
  assert.equal(classified.google_maps, null);
});

test('Danish drinks pages qualify as menus', async () => {
  const drinks = {
    url: 'https://www.lavaaarhus.dk/drikkevarer',
    text: 'Drikkevarer',
  };

  const { classified } = await classifyLinks([drinks]);
  assert.deepEqual(classified.menu_all.map((item) => item.url), [drinks.url]);
});

test('ordinary large restaurant photos are not menu images', () => {
  const result = classifyMenuStructure({
    links: [{
      url: 'https://cafefaust.dk/wp-content/uploads/dsc_4267-687x1030.jpg',
      text: '',
    }],
    buttons: [],
    images: [{
      url: 'https://cafefaust.dk/wp-content/uploads/dsc_4267-687x1030.jpg',
      alt: '',
      heading: '',
      caption: '',
      width: 687,
      height: 1030,
    }],
  }, 'https://cafefaust.dk/frokost/');

  assert.notEqual(result.structure, 'image_gallery');
});

test('inline menu text wins over menu-themed decorative photos', () => {
  const result = classifyMenuStructure({
    links: [],
    buttons: [],
    bodyText: 'MENUKORT BRUNCH Æg 95,- Frokostburger 165,- Dessert 85,-',
    images: [{
      url: 'https://cafefaust.dk/wp-content/uploads/brunch6.jpg',
      alt: 'Brunch at Café Faust',
      heading: 'Brunch',
      caption: '',
      width: 1200,
      height: 800,
    }],
  }, 'https://cafefaust.dk/brunch/');

  assert.equal(result.structure, 'inline_html');
});

test('menu-labelled rendered PDF assets remain menu images', () => {
  const result = classifyMenuStructure({
    links: [],
    buttons: [],
    images: [{
      url: 'https://media.uheadless.com/media/souk-frokost-menu.pdf?w=1600&page=1',
      alt: 'Souk Frokost Menu SUMMER',
      heading: 'Frokost',
      caption: '',
      width: 1200,
      height: 1600,
    }],
  }, 'https://soukaarhus.dk/da/menu');

  assert.equal(result.structure, 'image_gallery');
  assert.equal(result.assets.displayedImages.length, 1);
});
