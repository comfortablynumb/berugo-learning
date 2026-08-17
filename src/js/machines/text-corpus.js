/**
 * The corpora every M06 section is measured on, plus the generators that make
 * a string adversarial.
 *
 * Bundled rather than fetched: the app runs offline, and a figure quoted in
 * prose has to be reproducible from the repository alone. The four corpora are
 * deliberately different shapes, because every structure in this milestone is
 * sensitive to a different one:
 *
 *   - `words`   — 883 English words, the case tries were invented for: heavy
 *                 prefix sharing, 26-letter alphabet, short keys.
 *   - `dna`     — a 4-letter alphabet, which is where suffix structures shine
 *                 and where a 256-slot alphabet array is 98% waste.
 *   - `logs`    — line-structured text with a small vocabulary and long runs
 *                 of repeated tokens: the inverted index's natural input.
 *   - `source`  — JavaScript source, mixed alphabet with long shared prefixes
 *                 in identifiers.
 *
 * The adversarial generators matter more than the corpora. A suffix structure
 * measured only on English looks linear; measured on `repeated('a', n)` it is
 * where the quadratic blow-ups live, and `fibonacciWord` is the standard
 * worst case for the number of distinct substrings.
 */
(function (root, factory) {
  const api = factory(root && root.Random ? root.Random : (typeof require === 'function' ? require('../utils/random.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextCorpus = api;
}(typeof window !== 'undefined' ? window : null, function (Random) {
  'use strict';

  const WORDS = ('able about above accept access account across act action active actual add address ' +
    'admit adopt adult advance advice affair affect afford afraid after again against age agency agent ' +
    'agree ahead aim air all allow almost alone along already also although always among amount analyse ' +
    'ancient anger angle animal announce annual another answer any apart apparent appeal appear apple ' +
    'apply appoint approach approve area argue arise arm army around arrange arrive art article artist ' +
    'as ask aspect assess asset assume attach attack attempt attend attract author autumn available ' +
    'average avoid award aware away baby back background bad bag balance ball band bank bar base basic ' +
    'basis battle be bear beat beauty because become bed before begin behalf behaviour behind belief ' +
    'believe belong below bench benefit best better between beyond big bill bind bird birth bit black ' +
    'block blood blow blue board boat body bone book border born both bottle bottom box boy brain branch ' +
    'brand break breath bridge brief bright bring broad brother budget build burn bus business busy but ' +
    'buy cabinet call campaign can candidate capacity capital captain car card care career careful carry ' +
    'case cash cast cat catch cause cell centre century certain chain chair challenge chance change ' +
    'channel chapter character charge cheap check chemical chief child choice choose church circle city ' +
    'civil claim class clean clear clerk client climb clock close cloth cloud club coal coast code coffee ' +
    'cold collect college colour combine come comfort command comment commit common company compare ' +
    'compete complete complex computer concept concern conclude condition conduct confirm conflict ' +
    'connect consider consist constant consume contact contain content contest context continue contract ' +
    'contrast control convert cook cool copy core corner correct cost could council count country couple ' +
    'course court cover create credit crime crisis critical cross crowd cry culture cup current custom ' +
    'cut cycle damage dance danger dark data date daughter day deal dear death debate debt decade decide ' +
    'declare decline deep defence define degree delay deliver demand deny depend deposit depth derive ' +
    'describe design desire desk despite destroy detail detect develop device devote die differ difficult ' +
    'digital dinner direct dirty disappear discover discuss disease display distance distinct divide ' +
    'doctor document dog domestic door double doubt down draft draw dream dress drink drive drop drug dry ' +
    'due during duty each early earn earth ease east easy eat economy edge edit educate effect effort egg ' +
    'eight either elect element else emerge emotion employ empty enable encounter encourage end enemy ' +
    'energy engage engine enjoy enough ensure enter entire entry environment equal equip error escape ' +
    'essay establish estate estimate even evening event ever every evidence exact examine example exceed ' +
    'except exchange excite exclude excuse execute exercise exist expand expect expense experience expert ' +
    'explain explore export express extend extent external extra extreme eye face fact factor fail fair ' +
    'faith fall false familiar family famous far farm fashion fast father fault favour fear feature feed ' +
    'feel female few field fight figure file fill film final finance find fine finger finish fire firm ' +
    'first fish fit five fix flat flight floor flow flower fly focus follow food foot for force foreign ' +
    'forest forget form former forward found four frame free fresh friend from front fruit fuel full fun ' +
    'function fund further future gain game gap garden gas gate gather general generate gentle get gift ' +
    'girl give glass global go goal gold good govern grade grain grand grant graph great green grey ground ' +
    'group grow guard guess guest guide gun hair half hall hand handle hang happen happy hard harm hat ' +
    'hate have head health hear heart heat heavy height help hence here high hill history hit hold hole ' +
    'holiday home honest hope horse hospital host hot hotel hour house however huge human hundred hunt ' +
    'hurt idea ideal identify if ignore ill image imagine impact imply import impose improve include ' +
    'income increase indeed index indicate individual industry infant inform initial injury inner input ' +
    'inquiry inside insist install instance instead institute instruct insurance intend interest internal ' +
    'introduce invest invite involve iron island issue item job join joint joke journey joy judge jump ' +
    'just keep key kid kill kind king kitchen knee know knowledge labour lack lady land language large ' +
    'last late laugh launch law lay lead leaf learn least leave left legal length less let letter level ' +
    'library lie life lift light like limit line link lip list listen little live load loan local locate ' +
    'lock long look lose loss lot loud love low luck lunch machine magazine main maintain major make male ' +
    'man manage manner many map march mark market marry mass master match material matter may mean measure ' +
    'meat media medical meet member memory mention menu mere message metal method middle might mile milk ' +
    'mind mine minister minor minute miss mistake mix mobile model modern moment money monitor month moral ' +
    'more morning most mother motion mount mouth move much murder muscle music must myself narrow nation ' +
    'native natural nature near neat necessary neck need negative neighbour neither nerve net network ' +
    'never new news next nice night nine no noise none nor normal north nose not note nothing notice ' +
    'notion novel now nuclear number nurse object observe obtain obvious occasion occupy occur ocean odd ' +
    'of off offer office officer official often oil old on once one only open operate opinion opportunity ' +
    'oppose option order ordinary organ origin other otherwise ought out outcome output outside over own').split(' ');

  const DNA_UNITS = ['ACGT', 'ACGTT', 'GATTACA', 'CCGGA', 'TTTAGC', 'ACACAC', 'GGCATT', 'TACGGT'];

  const LOG_TEMPLATES = [
    'GET /api/users 200 12ms',
    'GET /api/users 200 15ms',
    'POST /api/orders 201 88ms',
    'GET /api/orders 200 21ms',
    'GET /health 200 1ms',
    'POST /api/login 401 33ms',
    'GET /api/users 500 903ms',
    'DELETE /api/session 204 4ms'
  ];

  const SOURCE = [
    'function createIndex(options) {',
    '  const settings = options || {};',
    '  const postings = new Map();',
    '  function addDocument(id, text) {',
    '    tokenize(text).forEach(function (term) { postings.get(term).push(id); });',
    '  }',
    '  function lookupTerm(term) { return postings.get(term) || []; }',
    '  return { addDocument: addDocument, lookupTerm: lookupTerm };',
    '}'
  ];

  /* ------------------------------------------------------------ corpora */

  /** The word list, optionally truncated. Sorted so a run is reproducible. */
  function words(limit) {
    const list = WORDS.slice();
    return limit ? list.slice(0, limit) : list;
  }

  /** A DNA string of the requested length, assembled from short motifs so it
   *  has the repeat structure a real sequence has rather than being uniform
   *  noise - uniform noise makes every suffix structure look its best. */
  function dna(length, seed) {
    const rng = Random.seeded(seed === undefined ? 1 : seed);
    let out = '';
    while (out.length < length) out += DNA_UNITS[rng.int(DNA_UNITS.length)];
    return out.slice(0, length);
  }

  /** Log lines, as one array of documents. */
  function logs(count, seed) {
    const rng = Random.seeded(seed === undefined ? 2 : seed);
    const lines = [];
    for (let i = 0; i < count; i += 1) {
      lines.push(LOG_TEMPLATES[rng.int(LOG_TEMPLATES.length)]);
    }
    return lines;
  }

  /** A short JavaScript source text. */
  function source() {
    return SOURCE.join('\n');
  }

  /* ------------------------------------------------- adversarial inputs */

  /** `repeated('a', 8)` = 'aaaaaaaa'. The suffix-structure worst case: n(n+1)/2
   *  suffixes that all share every prefix, so a suffix trie is quadratic and a
   *  suffix automaton has the fewest states it can possibly have. */
  function repeated(unit, times) {
    let out = '';
    for (let i = 0; i < times; i += 1) out += unit;
    return out;
  }

  /** The Fibonacci word: S1 = 'b', S2 = 'a', S(k) = S(k-1) + S(k-2). It is the
   *  standard extremal case for the number of distinct substrings and for the
   *  number of suffix-automaton states. */
  function fibonacciWord(order) {
    let previous = 'b';
    let current = 'a';
    for (let i = 2; i < order; i += 1) {
      const next = current + previous;
      previous = current;
      current = next;
    }
    return order <= 1 ? previous : current;
  }

  /** A random string over an alphabet of the given size. */
  function randomText(length, alphabet, seed) {
    const rng = Random.seeded(seed === undefined ? 3 : seed);
    const letters = 'abcdefghijklmnopqrstuvwxyz'.slice(0, Math.max(1, alphabet));
    let out = '';
    for (let i = 0; i < length; i += 1) out += letters[rng.int(letters.length)];
    return out;
  }

  /** Keys that share one long prefix - the case a plain trie handles worst in
   *  nodes and a radix trie handles best. */
  function sharedPrefixKeys(count, prefixLength) {
    const prefix = repeated('x', prefixLength);
    const keys = [];
    for (let i = 0; i < count; i += 1) keys.push(prefix + i.toString(36));
    return keys;
  }

  /* ------------------------------------------------------------ helpers */

  /** Keys that are long and distinct almost from the first character - content
   *  hashes, object ids, UUIDs. A plain trie needs a node per character because
   *  nothing is shared past the first two or three; a radix trie needs one node
   *  per key. This is the case path compression is actually for, and it is a
   *  different case from "the keys share a long prefix", which a plain trie
   *  already handles by sharing it. */
  function hexKeys(count, length, seed) {
    const rng = Random.seeded(seed === undefined ? 9 : seed);
    const digits = '0123456789abcdef';
    const out = new Set();

    while (out.size < count) {
      let key = '';
      for (let i = 0; i < length; i += 1) key += digits[rng.int(16)];
      out.add(key);
    }
    return Array.from(out);
  }

  /** Documents over a Zipf-distributed vocabulary: term i has frequency
   *  proportional to 1/i, which is what natural language does and what makes a
   *  posting list skew - a handful of terms in nearly every document and a long
   *  tail in almost none. A uniform vocabulary makes every intersection
   *  strategy look the same, which is exactly the wrong lesson. */
  function zipfDocuments(options) {
    const settings = options || {};
    const count = settings.count || 2000;
    const vocabulary = settings.vocabulary || 400;
    const perDocument = settings.perDocument || 12;
    const rng = Random.seeded(settings.seed === undefined ? 5 : settings.seed);

    const weights = [];
    let total = 0;
    for (let i = 1; i <= vocabulary; i += 1) { total += 1 / i; weights.push(total); }

    const pick = function () {
      const target = rng.next() * total;
      let low = 0;
      let high = weights.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (weights[mid] < target) low = mid + 1;
        else high = mid;
      }
      return 't' + low;
    };

    const documents = [];
    for (let i = 0; i < count; i += 1) {
      const terms = [];
      for (let j = 0; j < perDocument; j += 1) terms.push(pick());
      documents.push(terms.join(' '));
    }
    return documents;
  }

  /** Distinct characters in a string, which is what an alphabet array is
   *  sized against and what makes the 256-slot node wasteful. */
  function alphabetOf(text) {
    const seen = new Set();
    for (let i = 0; i < text.length; i += 1) seen.add(text[i]);
    return Array.from(seen).sort();
  }

  /** Every distinct substring of a string, by brute force. Only usable up to a
   *  few hundred characters - it exists so the suffix structures have a
   *  reference to be checked against rather than a formula to be trusted. */
  function distinctSubstrings(text) {
    const seen = new Set();
    for (let i = 0; i < text.length; i += 1) {
      for (let j = i + 1; j <= text.length; j += 1) seen.add(text.slice(i, j));
    }
    return seen;
  }

  /** Occurrences of a pattern, by brute force, for the same reason. */
  function occurrences(text, pattern) {
    const found = [];
    if (!pattern.length) return found;
    let at = text.indexOf(pattern);
    while (at !== -1) {
      found.push(at);
      at = text.indexOf(pattern, at + 1);
    }
    return found;
  }

  return {
    words: words,
    dna: dna,
    logs: logs,
    source: source,
    repeated: repeated,
    fibonacciWord: fibonacciWord,
    randomText: randomText,
    sharedPrefixKeys: sharedPrefixKeys,
    hexKeys: hexKeys,
    zipfDocuments: zipfDocuments,
    alphabetOf: alphabetOf,
    distinctSubstrings: distinctSubstrings,
    occurrences: occurrences,
    templates: function () { return LOG_TEMPLATES.slice(); }
  };
}));
