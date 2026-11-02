// Word-boundary matching for technology and place terms.
//
// The naive `text.includes(term)` is wrong in a way that quietly destroys the
// ranking: "oman" matches inside "Romania", "sql" inside "NoSQL", "go" inside
// "going". The first version of this tool put a Bucharest job at the top of the
// list as a no-visa-needed Gulf role because of exactly that.

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

// \b does not behave next to '#', '+' or a leading '.', so the boundary is
// expressed as "not adjacent to a word character" instead.
function toRegex(term) {
  const t = term.toLowerCase().trim();
  const body = t.replace(ESCAPE, '\\$&');
  // A term that opens with punctuation (".net") carries its own left boundary,
  // so requiring another one would stop it matching "ASP.NET Core".
  const left = /^[a-z0-9]/.test(t) ? '(?<![a-z0-9+#.])' : '';
  const right = /[a-z0-9]$/.test(t) ? '(?![a-z0-9+#])' : '(?![a-z0-9])';
  return new RegExp(left + body + right, 'i');
}

const cache = new Map();

export function contains(text, term) {
  if (!text) return false;
  let re = cache.get(term);
  if (!re) { re = toRegex(term); cache.set(term, re); }
  return re.test(text);
}

export function countMatches(text, terms) {
  return terms.filter((t) => contains(text, t)).length;
}

export function firstMatch(text, terms) {
  return terms.find((t) => contains(text, t)) || null;
}
