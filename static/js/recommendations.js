/*
 * KANTA KARAOKE — local smart recommendations.
 *
 * The app has no server-side database: queue, favorites, history and searches
 * live in localStorage. This module keeps the recommendation logic pure so it
 * can be used by the page and tested with Node.
 *
 * No external AI/service is called. Default picks come from a small curated
 * catalog of karaoke videos that were checked as embeddable; once the user
 * interacts with the app, their own favorites/history/searches are scored
 * against the catalog and their previously found songs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KantaRecommendations = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function thumbFor(id) {
    return id ? 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg' : '';
  }

  // Curated default catalog. `trending` means hand-picked for the Trending row;
  // popularity is a 0-100 editorial score, not a live YouTube metric.
  const RAW_CATALOG = [
    // International / pop
    { id: 'doWWkG2gPPE', title: 'Hello', artist: 'Adele', tags: ['pop', 'ballad'], popularity: 95 },
    { id: 'rMSQwIp4Jg8', title: 'Someone Like You', artist: 'Adele', tags: ['pop', 'ballad'], popularity: 92 },
    { id: 'B3O1OlTWXSA', title: 'Rolling in the Deep', artist: 'Adele', tags: ['pop', 'soul'], popularity: 90 },
    { id: '5QBn1B-6cPc', title: 'Perfect', artist: 'Ed Sheeran', tags: ['pop', 'ballad'], popularity: 93 },
    { id: 'Sykj3KRNV7U', title: 'Shape of You', artist: 'Ed Sheeran', tags: ['pop'], popularity: 88 },
    { id: 'j1DfXFCHLDI', title: 'Bohemian Rhapsody', artist: 'Queen', tags: ['rock', 'classic'], popularity: 91 },
    { id: '1pOFPExPDCY', title: "Don't Stop Believin'", artist: 'Journey', tags: ['rock', 'classic'], popularity: 85 },
    { id: 'qjMSGIfB1j8', title: 'Dancing Queen', artist: 'ABBA', tags: ['pop', 'dance', 'classic'], popularity: 84 },
    { id: '6BXivcr9uvE', title: 'I Will Always Love You', artist: 'Whitney Houston', tags: ['pop', 'ballad', 'classic'], popularity: 89 },
    { id: 'tQOw_R2gx2E', title: 'My Heart Will Go On', artist: 'Celine Dion', tags: ['pop', 'ballad', 'classic'], popularity: 88 },
    { id: 'c7qAHxBt-z4', title: 'My Way', artist: 'Frank Sinatra', tags: ['classic', 'ballad'], popularity: 80 },
    { id: 'DIC1AzEgnnw', title: 'Just the Way You Are', artist: 'Bruno Mars', tags: ['pop', 'soul'], popularity: 86 },
    { id: '1--pwdu-eJE', title: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', tags: ['pop', 'ballad'], popularity: 96, trending: true },
    { id: 'I5JTCGLfdfU', title: 'Espresso', artist: 'Sabrina Carpenter', tags: ['pop'], popularity: 94, trending: true },
    { id: 'Pq1W1kjIuLo', title: 'Good Luck, Babe!', artist: 'Chappell Roan', tags: ['pop'], popularity: 92, trending: true },
    { id: 't9ZaL7A5hw8', title: 'Lose Control', artist: 'Teddy Swims', tags: ['pop', 'soul'], popularity: 91, trending: true },
    { id: 'BG5bJRa3sBQ', title: 'Flowers', artist: 'Miley Cyrus', tags: ['pop'], popularity: 88, trending: true },
    { id: 'FYcebiijBbE', title: 'Beautiful Things', artist: 'Benson Boone', tags: ['pop', 'ballad'], popularity: 87, trending: true },
    { id: 'pphn92nK0P4', title: 'Too Sweet', artist: 'Hozier', tags: ['pop', 'soul'], popularity: 85, trending: true },
    { id: 'AAd8o14bTQg', title: 'A Bar Song (Tipsy)', artist: 'Shaboozey', tags: ['country', 'pop'], popularity: 86, trending: true },
    { id: '-itB1uWxxCg', title: 'I Had Some Help', artist: 'Post Malone & Morgan Wallen', tags: ['country', 'pop'], popularity: 84, trending: true },

    // OPM / Pinoy karaoke
    { id: 'MJd_6nqxIYw', title: 'Tadhana', artist: 'Up Dharma Down', tags: ['opm', 'pop', 'indie'], popularity: 93 },
    { id: 'F9qjC5G9jj8', title: 'Buwan', artist: 'Juan Karlos', tags: ['opm', 'rock', 'ballad'], popularity: 94 },
    { id: '1hAmBPNhaFs', title: 'Ang Huling El Bimbo', artist: 'Eraserheads', tags: ['opm', 'rock', 'classic'], popularity: 92 },
    { id: 'iufHUf-fxPw', title: 'Ligaya', artist: 'Eraserheads', tags: ['opm', 'rock', 'classic'], popularity: 86 },
    { id: 'm4EZrJqGXz8', title: 'Ikaw', artist: 'Yeng Constantino', tags: ['opm', 'pop', 'ballad'], popularity: 90 },
    { id: 'FG6RXG-K8N0', title: 'Malaya', artist: 'Moira Dela Torre', tags: ['opm', 'pop', 'ballad'], popularity: 89 },
    { id: 'dWpBJUAV5N0', title: 'Paubaya', artist: 'Moira Dela Torre', tags: ['opm', 'pop', 'ballad'], popularity: 91 },
    { id: 'Qyc-as1mx7s', title: 'Kathang Isip', artist: 'Ben&Ben', tags: ['opm', 'pop', 'indie'], popularity: 90 },
    { id: 'rRDYOBa6ySA', title: 'Leaves', artist: 'Ben&Ben', tags: ['opm', 'pop', 'indie'], popularity: 87 },
    { id: 'RDc_QsLE75o', title: "Kung 'Di Rin Lang Ikaw", artist: 'December Avenue', tags: ['opm', 'pop', 'ballad'], popularity: 90 },
    { id: 'TvGifmI3nhk', title: 'Eroplanong Papel', artist: 'December Avenue', tags: ['opm', 'pop', 'ballad'], popularity: 84 },
    { id: 'NyKqrUGhgEE', title: 'Kung Wala Ka', artist: 'Hale', tags: ['opm', 'rock', 'ballad'], popularity: 86 },
    { id: '2QcJ8lwbtsE', title: 'Harana', artist: 'Parokya ni Edgar', tags: ['opm', 'pop', 'rock'], popularity: 88 },
    { id: 'XjoRpoSq8lk', title: 'Noypi', artist: 'Bamboo', tags: ['opm', 'rock'], popularity: 87 },
    { id: 'cpxfRMs9fK4', title: 'Pangako', artist: 'Regine Velasquez', tags: ['opm', 'ballad'], popularity: 84 },
    { id: 't-R0whXGk-Y', title: 'Tala', artist: 'Sarah Geronimo', tags: ['opm', 'pop', 'dance'], popularity: 88 },
    { id: 'tu8vdo6G62o', title: 'Mundo', artist: 'IV of Spades', tags: ['opm', 'pop', 'rock'], popularity: 86 },
    { id: 'uCTx8b7r7fE', title: 'Hinahanap-Hanap Kita', artist: 'Rivermaya', tags: ['opm', 'rock', 'classic'], popularity: 85 },
    { id: '_3S1MOTzkcg', title: 'Pumapatak ang Ulan', artist: 'APO Hiking Society', tags: ['opm', 'pop', 'classic'], popularity: 82 },
    { id: 'nF0qxXx8r5Q', title: 'Natutulog Ba Ang Diyos', artist: 'Gary Valenciano', tags: ['opm', 'ballad', 'classic'], popularity: 82 },
    { id: 'peyOV8SxKks', title: 'Kahit Isang Saglit', artist: 'Martin Nievera', tags: ['opm', 'ballad', 'classic'], popularity: 83 },
    { id: 'is0SQqGDyTI', title: 'Binibini', artist: 'Zack Tabudlo', tags: ['opm', 'pop'], popularity: 88, trending: true },
    { id: 'jipLQRUYjxs', title: 'Pagsamo', artist: 'Arthur Nery', tags: ['opm', 'pop'], popularity: 90, trending: true },
    { id: 'prS1hjEY3OY', title: 'Mahika', artist: 'Adie', tags: ['opm', 'pop'], popularity: 88, trending: true },
    { id: 'ZDgyfqricXs', title: 'Uhaw', artist: 'Dilaw', tags: ['opm', 'rock'], popularity: 91, trending: true },
    { id: '05TCevz9MTY', title: 'Pasilyo', artist: 'SunKissed Lola', tags: ['opm', 'pop'], popularity: 90, trending: true },
    { id: 'KWpvlL7kXCY', title: 'Misteryoso', artist: 'Cup of Joe', tags: ['opm', 'pop'], popularity: 87, trending: true }
  ];

  const CATALOG = Object.freeze(RAW_CATALOG.map(song => Object.freeze({
    id: song.id,
    title: song.title,
    artist: song.artist,
    tags: Object.freeze(song.tags.slice()),
    popularity: song.popularity,
    trending: !!song.trending,
    thumb: thumbFor(song.id)
  })));

  const CATALOG_BY_ID = new Map(CATALOG.map(song => [song.id, song]));
  const CATALOG_BY_ARTIST = new Map();
  const KNOWN_ARTISTS = new Set();
  const KNOWN_TITLES = new Set(CATALOG.map(song => normalize(song.title)));

  CATALOG.forEach(song => {
    artistKeys(song.artist).forEach(key => {
      KNOWN_ARTISTS.add(key);
      if (!CATALOG_BY_ARTIST.has(key)) CATALOG_BY_ARTIST.set(key, song);
    });
  });

  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for',
    'from', 'had', 'has', 'have', 'he', 'her', 'his', 'i', 'if', 'in', 'is',
    'it', 'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'she',
    'so', 'that', 'the', 'their', 'them', 'there', 'these', 'they', 'this',
    'to', 'was', 'we', 'were', 'will', 'with', 'you', 'your',
    'karaoke', 'videoke', 'instrumental', 'lyrics', 'lyric', 'version', 'video',
    'official', 'audio', 'song', 'songs', 'hd', '4k', 'mv', 'live', 'cover',
    'original', 'key', 'guide', 'melody', 'backing', 'track', 'minus', 'one',
    'full', 'band', 'female', 'male', 'music', 'sing', 'along',
    'ang', 'ng', 'sa', 'na', 'at', 'ay', 'ko', 'mo', 'ka', 'si', 'ni', 'ito',
    'iyan', 'iyon', 'para', 'mga', 'kung', 'lang'
  ]);

  const OPM_SEARCH_TERMS = new Set(['opm', 'tagalog', 'pinoy', 'filipino', 'pilipino']);

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function tokenize(value) {
    const seen = new Set();
    return normalize(value)
      .split(' ')
      .filter(token => token.length >= 3 && !STOP_WORDS.has(token))
      .filter(token => {
        if (seen.has(token)) return false;
        seen.add(token);
        return true;
      });
  }

  function artistParts(value) {
    return String(value == null ? '' : value)
      .split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\band\b)\s*/i)
      .map(normalize)
      .filter(Boolean);
  }

  function artistKeys(value) {
    const full = normalize(value);
    const keys = new Set(artistParts(value));
    if (full) keys.add(full);
    return Array.from(keys);
  }

  function isKnownArtist(value) {
    return artistKeys(value).some(key => KNOWN_ARTISTS.has(key));
  }

  function isKnownTitle(value) {
    return KNOWN_TITLES.has(normalize(value));
  }

  function stripDecorations(value) {
    return String(value == null ? '' : value)
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\b(?:karaoke|videoke|instrumental|lyrics?|sing[\s-]?along|backing track|minus one|guide melody|no guide melody|original key|female key|male key|full band|music video|official|video|hd|4k)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanChannel(value) {
    const name = String(value == null ? '' : value)
      .replace(/\s*[-–—|].*$/, '')
      .replace(/\.{2,}$/, '')
      .trim();
    if (!name || /karaoke|videoke|cover|sing|lyrics|music|record|official/i.test(name)) {
      return 'Various Artists';
    }
    return name;
  }

  /**
   * Derive a display artist from noisy YouTube titles such as
   * "Hello - Adele (Karaoke Songs With Lyrics)" or
   * "Adele - Hello (Karaoke Version)".
   */
  function extractArtist(title, channel) {
    const original = String(title == null ? '' : title).trim();
    const base = stripDecorations(original);

    if (!base) return cleanChannel(channel);

    const parts = base
      .split(/\s+[-–—|]\s+/)
      .map(part => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      const firstArtist = isKnownArtist(first);
      const lastArtist = isKnownArtist(last);
      const firstTitle = isKnownTitle(first);
      const lastTitle = isKnownTitle(last);

      if (firstArtist && !lastArtist) return first;
      if (lastArtist && !firstArtist) return last;
      if (firstTitle && !lastTitle) return last;
      if (lastTitle && !firstTitle) return first;

      // Common title patterns when neither side is in our catalog.
      if (first === first.toUpperCase() && last !== last.toUpperCase()) return last;
      const firstWords = first.split(/\s+/).length;
      const lastWords = last.split(/\s+/).length;
      if (firstWords === 1 && lastWords >= 2) return last;
      if (firstWords >= 2 && lastWords === 1) return first;
      return first;
    }

    const byMatch = base.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) return byMatch[2].trim();

    return cleanChannel(channel);
  }

  function artistOf(song) {
    if (!song) return 'Various Artists';
    const given = String(song.artist == null ? '' : song.artist).trim();
    if (given) return given;
    return extractArtist(song.title, song.channel);
  }

  function tagsFor(song) {
    if (!song) return [];
    const byId = CATALOG_BY_ID.get(song.id);
    if (byId) return byId.tags;
    const byArtist = CATALOG_BY_ARTIST.get(normalize(artistOf(song)));
    if (byArtist) return byArtist.tags;
    return Array.isArray(song.tags) ? song.tags : [];
  }

  function publicSong(song) {
    const id = String(song && song.id ? song.id : '');
    return {
      id,
      title: String(song && song.title ? song.title : 'Untitled'),
      artist: artistOf(song),
      thumb: (song && song.thumb) || thumbFor(id)
    };
  }

  function titleForMatch(song) {
    const base = normalize(stripDecorations(song && song.title));
    const artist = normalize(artistOf(song));
    let title = base;
    if (artist) {
      if (base.indexOf(artist + ' ') === 0) title = base.slice(artist.length + 1);
      else if (base.slice(-(artist.length + 1)) === ' ' + artist) title = base.slice(0, -(artist.length + 1));
    }
    title = title.replace(/^(?:ang|the|a|an)\s+/, '');
    return title || base;
  }

  function songKey(song) {
    return normalize(artistOf(song)) + '|' + titleForMatch(song);
  }

  function uniqueSongs(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).filter(song => {
      if (!song || !song.id || seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });
  }

  function uniqueSongsByKey(list) {
    const seen = new Set();
    return uniqueSongs(list).filter(song => {
      const key = songKey(song);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function idsOf(list) {
    return uniqueSongs(list).map(song => song.id);
  }

  function addWeight(map, key, amount) {
    if (!key || !amount) return;
    map.set(key, (map.get(key) || 0) + amount);
  }

  function buildProfile(state, favoritesOnly) {
    state = state || {};
    const favs = uniqueSongs(state.favs);
    const history = favoritesOnly ? [] : uniqueSongs(state.history);
    const searches = favoritesOnly ? [] : (Array.isArray(state.searches) ? state.searches.slice(0, 12) : []);
    const current = favoritesOnly ? null : (state.current || null);
    const artists = new Map();
    const tags = new Map();
    const terms = new Map();

    favs.forEach(song => {
      artistKeys(artistOf(song)).forEach(key => addWeight(artists, key, 6));
      tagsFor(song).forEach(tag => addWeight(tags, tag, 3));
      tokenize(artistOf(song) + ' ' + song.title).forEach(token => addWeight(terms, token, 2.5));
    });

    history.forEach((song, index) => {
      const weight = Math.max(0.35, 1 - index / Math.max(history.length, 1));
      artistKeys(artistOf(song)).forEach(key => addWeight(artists, key, 3 * weight));
      tagsFor(song).forEach(tag => addWeight(tags, tag, 1.5 * weight));
      tokenize(artistOf(song) + ' ' + song.title).forEach(token => addWeight(terms, token, 1.2 * weight));
    });

    if (current) {
      artistKeys(artistOf(current)).forEach(key => addWeight(artists, key, 2));
      tagsFor(current).forEach(tag => addWeight(tags, tag, 1));
      tokenize(artistOf(current) + ' ' + current.title).forEach(token => addWeight(terms, token, 0.8));
    }

    searches.forEach((query, index) => {
      const weight = Math.max(0.3, 1 - index / Math.max(searches.length, 1));
      const tokens = tokenize(query);
      tokens.forEach(token => {
        addWeight(terms, token, 2 * weight);
        if (OPM_SEARCH_TERMS.has(token)) addWeight(tags, 'opm', 3.5 * weight);
      });
    });

    return {
      artists,
      tags,
      terms,
      searches,
      favorites: favs,
      hasSignals: favs.length > 0 || history.length > 0 || searches.length > 0 || !!current
    };
  }

  function buildPool(state) {
    const map = new Map();

    function add(song) {
      if (!song || !song.id) return;
      const id = String(song.id);
      if (!map.has(id)) {
        map.set(id, {
          id,
          title: String(song.title || 'Untitled'),
          artist: artistOf(song),
          thumb: song.thumb || thumbFor(id),
          tags: tagsFor(song),
          popularity: Number.isFinite(song.popularity) ? song.popularity : 75,
          trending: !!song.trending
        });
      }
    }

    CATALOG.forEach(add);
    uniqueSongs(state && state.favs).forEach(add);
    uniqueSongs(state && state.history).forEach(add);
    uniqueSongs(state && state.queue).forEach(add);
    uniqueSongs(state && state.results).forEach(add);
    if (state && state.current) add(state.current);

    return Array.from(map.values());
  }

  function artistAffinity(profile, artist) {
    let best = 0;
    artistKeys(artist).forEach(key => {
      const value = profile.artists.get(key) || 0;
      if (value > best) best = value;
    });
    return best;
  }

  function scoreSong(song, profile) {
    let score = ((song.popularity - 70) / 10);
    if (!Number.isFinite(score)) score = 0.5;
    if (song.trending) score += 1.2;

    let matched = false;

    const artistScore = artistAffinity(profile, song.artist);
    if (artistScore > 0) {
      score += artistScore * 8;
      matched = true;
    }

    let tagScore = 0;
    (song.tags || []).forEach(tag => {
      tagScore += profile.tags.get(tag) || 0;
    });
    if (tagScore > 0) {
      score += Math.min(tagScore, 14) * 2.2;
      matched = true;
    }

    let termScore = 0;
    tokenize(song.artist + ' ' + song.title).forEach(token => {
      termScore += profile.terms.get(token) || 0;
    });
    if (termScore > 0) {
      score += Math.min(termScore, 12) * 1.6;
      matched = true;
    }

    const haystack = normalize(song.artist + ' ' + song.title);
    profile.searches.forEach(query => {
      const normalizedQuery = normalize(query);
      if (normalizedQuery.length >= 4 && haystack.includes(normalizedQuery)) {
        score += 6;
        matched = true;
      }
    });

    return { score, matched };
  }

  function rank(pool, profile, options) {
    options = options || {};
    const excluded = options.exclude || new Set();
    const excludedKeys = options.excludeKeys || new Set();
    const scored = [];

    pool.forEach(song => {
      if (excluded.has(song.id) || excludedKeys.has(songKey(song))) return;
      if (options.predicate && !options.predicate(song)) return;
      const result = scoreSong(song, profile);
      if (options.requireMatch && !result.matched) return;
      scored.push({ song, score: result.score });
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.song.popularity !== a.song.popularity) return b.song.popularity - a.song.popularity;
      return a.song.title.localeCompare(b.song.title);
    });

    const seenKeys = new Set();
    return scored.filter(item => {
      const key = songKey(item.song);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    }).map(item => item.song);
  }

  function topFavoriteArtist(favorites) {
    const counts = new Map();
    const names = new Map();
    favorites.forEach(song => {
      const artist = artistOf(song);
      const key = normalize(artist);
      counts.set(key, (counts.get(key) || 0) + 1);
      names.set(key, artist);
    });
    let bestKey = '';
    let bestCount = 0;
    counts.forEach((count, key) => {
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    });
    return bestKey ? names.get(bestKey) : '';
  }

  function category(id, label, title, icon, description, songs, emptyText) {
    return {
      id,
      label,
      title,
      icon,
      description,
      songs: songs.slice(0, 6).map(publicSong),
      emptyText: emptyText || 'No picks yet.'
    };
  }

  /**
   * Build all five suggestion groups from the current localStorage-backed state.
   * Pure and dependency-free; the UI caches the result until `signature` changes.
   */
  function buildSuggestions(state, options) {
    options = options || {};
    state = state || {};
    const limit = Math.max(1, Number(options.limit) || 6);
    const pool = buildPool(state);
    const profile = buildProfile(state, false);
    const favoriteProfile = buildProfile(state, true);

    const favorites = uniqueSongs(state.favs);
    const favoriteIds = new Set(idsOf(favorites));
    const favoriteKeys = new Set(favorites.map(songKey));
    const history = uniqueSongs(state.history);
    const historyKeys = new Set(history.map(songKey));
    const currentId = state.current && state.current.id;
    const baseExclude = new Set(idsOf(state.queue));
    const baseKeys = new Set(uniqueSongs(state.queue).map(songKey));
    if (currentId) baseExclude.add(currentId);
    if (state.current) baseKeys.add(songKey(state.current));
    const forYouExclude = new Set(Array.from(baseExclude).concat(Array.from(favoriteIds)));
    const forYouKeys = new Set(Array.from(baseKeys).concat(Array.from(favoriteKeys), Array.from(historyKeys)));
    const similarExclude = new Set(Array.from(baseExclude).concat(Array.from(favoriteIds)));
    const similarKeys = new Set(Array.from(baseKeys).concat(Array.from(favoriteKeys)));

    const forYou = rank(pool, profile, { exclude: forYouExclude, excludeKeys: forYouKeys }).slice(0, limit);
    const trending = rank(pool, profile, {
      exclude: baseExclude,
      excludeKeys: baseKeys,
      predicate: song => song.trending
    }).slice(0, limit);
    const opm = rank(pool, profile, {
      exclude: baseExclude,
      excludeKeys: baseKeys,
      predicate: song => song.tags.indexOf('opm') !== -1
    }).slice(0, limit);
    const recent = uniqueSongsByKey(history).slice(0, limit);
    const similar = rank(pool, favoriteProfile, {
      exclude: similarExclude,
      excludeKeys: similarKeys,
      requireMatch: true
    }).slice(0, limit);

    const favoriteArtist = topFavoriteArtist(favorites);
    const forYouDescription = profile.hasSignals
      ? 'Picked from your favorites, searches and recent plays.'
      : 'Popular and trending karaoke to get you started.';
    const similarDescription = favorites.length
      ? (favoriteArtist ? 'More tracks inspired by ' + favoriteArtist + '.' : 'Tracks inspired by your favorites.')
      : 'Favorite a song to unlock closer picks.';
    const similarEmpty = favorites.length
      ? 'No close matches yet. Try favoriting a few more songs.'
      : 'Tap the heart on any song to unlock similar picks.';

    const categories = [
      category('forYou', 'For You', 'Recommended for You', 'fa-wand-magic-sparkles', forYouDescription, forYou,
        'You have already saved all the nearby picks. Try Trending!'),
      category('trending', 'Trending', 'Trending Karaoke Songs', 'fa-fire', 'Hand-picked karaoke crowd-pleasers for your next session.', trending,
        'Trending picks are unavailable right now.'),
      category('opm', 'OPM', 'Popular OPM Songs', 'fa-music', 'Pinoy karaoke favorites, from timeless hits to new-wave OPM.', opm,
        'OPM picks are unavailable right now.'),
      category('recent', 'Recent', 'Recently Played', 'fa-clock-rotate-left', 'Pick up where you left off.', recent,
        'Songs you play will show up here.'),
      category('similar', 'Like Favs', 'Similar to Your Favorites', 'fa-heart', similarDescription, similar, similarEmpty)
    ];

    return {
      personalized: profile.hasSignals,
      favoriteArtist,
      categories
    };
  }

  /**
   * Lightweight cache key. It changes only when recommendation inputs change —
   * player progress (S.pos) intentionally does not invalidate suggestions.
   */
  function signature(state) {
    state = state || {};
    const fingerprint = (list, includeArtist) => uniqueSongs(list).map(song =>
      includeArtist ? song.id + ':' + normalize(artistOf(song)) : song.id
    );
    return JSON.stringify({
      current: state.current && state.current.id ? state.current.id + ':' + normalize(artistOf(state.current)) : '',
      queue: fingerprint(state.queue, false),
      favs: fingerprint(state.favs, true),
      history: fingerprint(state.history, true),
      results: fingerprint(state.results, false),
      searches: (Array.isArray(state.searches) ? state.searches : []).map(query => String(query).trim()).filter(Boolean)
    });
  }

  return {
    CATALOG,
    buildSuggestions,
    signature,
    artistOf,
    extractArtist,
    normalize,
    tokenize,
    thumbFor
  };
});
