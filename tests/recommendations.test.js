'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../static/js/recommendations.js');

function emptyState() {
  return {
    current: null,
    queue: [],
    history: [],
    favs: [],
    results: [],
    searches: [],
    tab: 'search',
    suggestCat: 'forYou',
    pos: 0
  };
}

function categories(state, options) {
  const result = R.buildSuggestions(state, options);
  return {
    result,
    byId: Object.fromEntries(result.categories.map(category => [category.id, category]))
  };
}

function allSongs(data) {
  return data.categories.flatMap(category => category.songs);
}

const OPM_IDS = new Set(R.CATALOG.filter(song => song.tags.includes('opm')).map(song => song.id));
const TRENDING_IDS = new Set(R.CATALOG.filter(song => song.trending).map(song => song.id));

test('catalog contains unique, usable karaoke entries', () => {
  assert.ok(R.CATALOG.length >= 30);
  const ids = new Set();
  R.CATALOG.forEach(song => {
    assert.match(song.id, /^[A-Za-z0-9_-]{11}$/);
    assert.ok(!ids.has(song.id), 'duplicate catalog id: ' + song.id);
    ids.add(song.id);
    assert.ok(song.title.length > 0);
    assert.ok(song.artist.length > 0);
    assert.ok(Array.isArray(song.tags) && song.tags.length > 0);
    assert.equal(song.thumb, 'https://i.ytimg.com/vi/' + song.id + '/mqdefault.jpg');
  });
  assert.ok(R.CATALOG.some(song => song.trending));
  assert.ok(R.CATALOG.some(song => song.tags.includes('opm')));
});

test('extractArtist handles common karaoke title formats', () => {
  assert.equal(R.extractArtist('Hello - Adele (Karaoke Songs With Lyrics - Original Key)', 'Musisi Karaoke'), 'Adele');
  assert.equal(R.extractArtist('Adele - Hello (Karaoke Version)', 'Sing King'), 'Adele');
  assert.equal(R.extractArtist('PERFECT - Ed Sheeran (KARAOKE VERSION)', 'CoversPH'), 'Ed Sheeran');
  assert.equal(R.extractArtist('TADHANA - Up Dharma Down (KARAOKE VERSION)', 'CoversPH'), 'Up Dharma Down');
  assert.equal(R.extractArtist('HULING EL BIMBO - Eraserheads (HD Karaoke)', 'Atomic Karaoke'), 'Eraserheads');
  assert.equal(R.extractArtist('A song with no artist credit (Karaoke)', 'Sing King'), 'Various Artists');
  assert.equal(R.artistOf({ title: 'Adele - Hello', artist: 'Adele' }), 'Adele');
});

test('default suggestions use trending and popular karaoke with empty personal states', () => {
  const { result, byId } = categories(emptyState());

  assert.equal(result.personalized, false);
  assert.deepEqual(result.categories.map(category => category.id), ['forYou', 'trending', 'opm', 'recent', 'similar']);
  assert.equal(byId.forYou.songs.length, 6);
  assert.equal(byId.trending.songs.length, 6);
  assert.equal(byId.opm.songs.length, 6);
  assert.equal(byId.recent.songs.length, 0);
  assert.equal(byId.similar.songs.length, 0);
  assert.ok(byId.recent.emptyText.length > 0);
  assert.ok(byId.similar.emptyText.length > 0);

  byId.trending.songs.forEach(song => assert.ok(TRENDING_IDS.has(song.id)));
  byId.opm.songs.forEach(song => assert.ok(OPM_IDS.has(song.id)));

  allSongs(result).forEach(song => {
    assert.deepEqual(Object.keys(song).sort(), ['artist', 'id', 'thumb', 'title']);
    assert.ok(song.artist.length > 0);
  });
});

test('favoriting one version of a song recommends other songs, not the same track', () => {
  const state = emptyState();
  state.favs = [{ id: 'different-hello-video', title: 'Adele - Hello (Karaoke Version)', artist: 'Adele', thumb: '' }];

  const { result, byId } = categories(state);
  const forYouArtists = byId.forYou.songs.map(song => song.artist);
  const similarArtists = byId.similar.songs.map(song => song.artist);

  assert.equal(result.personalized, true);
  assert.equal(result.favoriteArtist, 'Adele');
  assert.ok(forYouArtists.includes('Adele'));
  assert.ok(similarArtists.includes('Adele'));
  assert.ok(byId.similar.description.includes('Adele'));

  byId.forYou.songs.forEach(song => {
    assert.ok(!(song.artist === 'Adele' && song.title === 'Hello'), 'favorite track must not be recommended again');
  });
  byId.similar.songs.forEach(song => {
    assert.ok(!(song.artist === 'Adele' && song.title === 'Hello'), 'favorite track must not appear in similar');
  });
});

test('OPM history raises OPM recommendations and keeps recently played unique', () => {
  const state = emptyState();
  state.history = [
    { id: 'history-tadhana', title: 'Tadhana', artist: 'Up Dharma Down', thumb: '' },
    { id: 'history-buwan', title: 'Buwan', artist: 'Juan Karlos', thumb: '' },
    { id: 'history-tadhana-2', title: 'TADHANA - Up Dharma Down (Karaoke)', artist: 'Up Dharma Down', thumb: '' }
  ];

  const { result, byId } = categories(state);
  const recentIds = byId.recent.songs.map(song => song.id);

  assert.equal(byId.recent.songs.length, 2);
  assert.deepEqual(recentIds, ['history-tadhana', 'history-buwan']);
  assert.ok(byId.forYou.songs.slice(0, 4).every(song => OPM_IDS.has(song.id) || song.artist === 'Ben&Ben'));
  assert.ok(byId.forYou.songs.every(song => song.title !== 'Tadhana' && song.title !== 'Buwan'));
  assert.ok(result.personalized);
});

test('search history personalizes recommendations without new network data', () => {
  const state = emptyState();
  state.searches = ['Adele'];

  const adele = categories(state);
  assert.ok(adele.byId.forYou.songs.some(song => song.artist === 'Adele'));

  state.searches = ['OPM'];
  const opm = categories(state);
  const opmCount = opm.byId.forYou.songs.filter(song => OPM_IDS.has(song.id)).length;
  assert.ok(opmCount >= 3);
});

test('current and queued songs are excluded, including alternate video versions', () => {
  const state = emptyState();
  state.current = { id: 'current-buwan', title: 'Buwan', artist: 'Juan Karlos', thumb: '' };
  state.queue = [{ id: 'queue-hello', title: 'Hello - Adele (Karaoke Version)', artist: 'Adele', thumb: '' }];

  const { byId } = categories(state);
  byId.forYou.songs.forEach(song => {
    assert.ok(!(song.artist === 'Adele' && song.title === 'Hello'));
    assert.ok(!(song.artist === 'Juan Karlos' && song.title === 'Buwan'));
  });
  byId.trending.songs.forEach(song => {
    assert.ok(!(song.artist === 'Adele' && song.title === 'Hello'));
    assert.ok(!(song.artist === 'Juan Karlos' && song.title === 'Buwan'));
  });
});

test('each category contains no duplicate video ids', () => {
  const state = emptyState();
  state.favs = [{ id: 'x', title: 'Hello - Adele (Karaoke)', artist: 'Adele', thumb: '' }];
  state.history = [{ id: 'y', title: 'Tadhana', artist: 'Up Dharma Down', thumb: '' }];
  state.searches = ['opm karaoke'];

  const { result } = categories(state);
  result.categories.forEach(category => {
    const ids = category.songs.map(song => song.id);
    assert.equal(new Set(ids).size, ids.length, category.title + ' has duplicate ids');
  });
});

test('signature ignores UI state and changes when recommendation inputs change', () => {
  const state = emptyState();
  const original = R.signature(state);

  state.pos = 123;
  state.tab = 'queue';
  state.suggestCat = 'opm';
  assert.equal(R.signature(state), original);

  state.searches = ['Adele'];
  const afterSearch = R.signature(state);
  assert.notEqual(afterSearch, original);

  state.favs = [{ id: 'fav', title: 'Hello', artist: 'Adele' }];
  assert.notEqual(R.signature(state), afterSearch);
});

test('limit option caps every returned category', () => {
  const { byId } = categories(emptyState(), { limit: 3 });
  ['forYou', 'trending', 'opm', 'recent', 'similar'].forEach(id => {
    assert.ok(byId[id].songs.length <= 3);
  });
});

test('buildSuggestions does not mutate the supplied state', () => {
  const state = emptyState();
  state.favs = [{ id: 'fav', title: 'Hello', artist: 'Adele' }];
  state.history = [{ id: 'hist', title: 'Tadhana', artist: 'Up Dharma Down' }];
  state.searches = ['opm'];
  const snapshot = JSON.stringify(state);

  R.buildSuggestions(state, { limit: 4 });

  assert.equal(JSON.stringify(state), snapshot);
});
