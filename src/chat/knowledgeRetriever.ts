import rawIndex from '../config/chatKnowledgeIndex.json' with { type: 'json' };

export type ChatSourceKind =
  | 'documentation'
  | 'catalog'
  | 'dossier'
  | 'simulation'
  | 'control_spec'
  | 'mission'
  | 'provenance';

export type ChatEvidenceType =
  | 'source_verified'
  | 'illustrative_or_simulated'
  | 'mixed'
  | 'policy';

export interface ChatKnowledgeChunk {
  id: string;
  title: string;
  sourcePath: string;
  section: string;
  sourceKind: ChatSourceKind;
  language: 'vi' | 'en' | 'mixed';
  evidenceType: ChatEvidenceType;
  sourceUrls: string[];
  text: string;
}

export interface ChatKnowledgeIndex {
  version: string;
  contentHash: string;
  chunkCount: number;
  chunks: ChatKnowledgeChunk[];
}

export interface ChatRetrievalMatch {
  chunk: ChatKnowledgeChunk;
  score: number;
  matchedTerms: string[];
  matchedSubstantiveTerms: string[];
}

export interface ChatRetrievalResult {
  sufficient: boolean;
  topScore: number;
  queryTerms: string[];
  substantiveTerms: string[];
  matches: ChatRetrievalMatch[];
}

export interface SearchKnowledgeOptions {
  topK?: number;
  minScore?: number;
  bodyHint?: 'mars' | 'moon';
  chunks?: ChatKnowledgeChunk[];
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from',
  'how', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'what',
  'when', 'where', 'which', 'who', 'why', 'with',
  'ai', 'bang', 'bao', 'bi', 'cac', 'cach', 'cai', 'cho', 'co', 'con', 'cua', 'cung', 'da',
  'dang', 'day', 'de', 'den', 'di', 'do', 'duoc', 'gi', 'hay', 'hien', 'hoac', 'hom', 'khi',
  'khong', 'la', 'lam', 'len', 'loai', 'luon', 'ma', 'minh', 'mot', 'muc', 'nao', 'nay', 'nen',
  'neu', 'ngay', 'nhieu', 'nhu', 'nhung', 'no', 'noi', 'o', 'phai', 'qua', 'ra', 'rat', 'roi',
  'sao', 'se', 'so', 'tai', 'theo', 'the', 'thi', 'thong', 'thoi', 'thu', 'tin', 'toi', 'tren',
  'trong', 'tu', 'va', 'vay', 've', 'vi', 'voi', 'vua',
]);

const VIETNAMESE_QUERY_ALIASES: Array<[RegExp, string]> = [
  [/\b(?:du lieu|nguon du lieu)\b/g, 'data source'],
  [/\bnguon\b/g, 'source'],
  [/\btruc thang\b/g, 'helicopter'],
  [/\bnang\b/g, 'mass'],
  [/\bdieu khien\b/g, 'control'],
  [/\bdia hinh\b/g, 'terrain'],
  [/\bmat trang\b/g, 'moon'],
  [/\bdo dac\b/g, 'measurement'],
  [/\bthat\b/g, 'real'],
  [/\bvi sao\b/g, 'why'],
  [/\btach\b/g, 'exclude'],
  [/\bsao hoa\b/g, 'mars'],
  [/\bdi chuyen\b/g, 'mobility movement'],
  [/\bban ve\b/g, 'about'],
];

export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function translateQueryAliases(input: string): string {
  return VIETNAMESE_QUERY_ALIASES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    normalizeSearchText(input),
  );
}

function tokenizeAccentedText(input: string): string[] {
  const nfcLower = input.normalize('NFC').toLowerCase();
  const tokens = nfcLower.match(/[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)*/gu) ?? [];
  const expanded: string[] = [];
  for (const tok of tokens) {
    expanded.push(tok);
    if (tok.includes('_')) {
      for (const sub of tok.split('_')) {
        if (sub.length >= 2) expanded.push(sub);
      }
    }
  }
  return expanded;
}

export function tokenizeSearchText(input: string): string[] {
  const normalized = normalizeSearchText(input);
  const tokens = normalized.match(/[a-z0-9]+(?:_[a-z0-9]+)*/g) ?? [];
  const expanded: string[] = [];
  for (const tok of tokens) {
    expanded.push(tok);
    if (tok.includes('_')) {
      for (const sub of tok.split('_')) {
        if (sub.length >= 2) expanded.push(sub);
      }
    }
  }
  return expanded;
}

export const CHAT_KNOWLEDGE_INDEX = rawIndex as ChatKnowledgeIndex;

export function searchKnowledgeChunks(
  query: string,
  options: SearchKnowledgeOptions = {},
): ChatRetrievalResult {
  const topK = options.topK ?? 5;
  const minScore = options.minScore ?? 7.5;
  const chunks = options.chunks ?? CHAT_KNOWLEDGE_INDEX.chunks;

  const rawTokens = tokenizeSearchText(translateQueryAliases(query));
  const queryTerms = [...new Set(rawTokens)];
  const substantiveTerms = queryTerms.filter(
    (t) => t.length >= 2 && !STOPWORDS.has(t),
  );

  const accentedByFolded = new Map<string, Set<string>>();
  for (const accTok of tokenizeAccentedText(query)) {
    const folded = normalizeSearchText(accTok);
    if (accTok !== folded) {
      const set = accentedByFolded.get(folded) ?? new Set<string>();
      set.add(accTok);
      accentedByFolded.set(folded, set);
    }
  }

  if (queryTerms.length === 0 || substantiveTerms.length === 0 || chunks.length === 0) {
    return {
      sufficient: false,
      topScore: 0,
      queryTerms,
      substantiveTerms,
      matches: [],
    };
  }

  const docData = chunks.map((chunk) => {
    const titleRaw = `${chunk.title} ${chunk.section} ${chunk.sourcePath}`;
    const titleTokens = tokenizeSearchText(titleRaw);
    const bodyTokens = tokenizeSearchText(chunk.text);
    const combinedTokens = [...titleTokens, ...titleTokens, ...titleTokens, ...bodyTokens];
    const tf = new Map<string, number>();
    for (const tok of combinedTokens) {
      tf.set(tok, (tf.get(tok) ?? 0) + 1);
    }
    const titleSet = new Set(titleTokens);
    const accentedSet = new Set([
      ...tokenizeAccentedText(titleRaw),
      ...tokenizeAccentedText(chunk.text),
    ]);
    return {
      chunk,
      tf,
      titleSet,
      accentedSet,
      length: combinedTokens.length,
    };
  });

  const avgDocLen =
    docData.reduce((sum, d) => sum + d.length, 0) / Math.max(1, docData.length);
  const df = new Map<string, number>();
  for (const term of substantiveTerms) {
    let count = 0;
    for (const d of docData) {
      if (d.tf.has(term)) count += 1;
    }
    df.set(term, count);
  }

  const k1 = 1.4;
  const b = 0.72;
  const N = docData.length;
  const normalizedQuery = normalizeSearchText(query);

  const scored: ChatRetrievalMatch[] = [];
  for (const doc of docData) {
    let score = 0;
    const matchedTerms: string[] = [];
    const matchedSubstantiveTerms: string[] = [];

    for (const term of substantiveTerms) {
      const freq = doc.tf.get(term) ?? 0;
      if (freq === 0) continue;
      matchedTerms.push(term);
      matchedSubstantiveTerms.push(term);
      const docFreq = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const tfNorm = (freq * (k1 + 1)) / (freq + k1 * (1 - b + (b * doc.length) / avgDocLen));
      let termScore = idf * tfNorm;
      if (doc.titleSet.has(term)) {
        termScore *= 1.35;
      }
      const queryAccentedForms = accentedByFolded.get(term);
      if (queryAccentedForms && queryAccentedForms.size > 0) {
        const hasExactAccented = [...queryAccentedForms].some((acc) => doc.accentedSet.has(acc));
        termScore *= hasExactAccented ? 1.15 : 0.45;
      }
      score += termScore;
    }

    if (matchedSubstantiveTerms.length === 0) continue;

    // Reward multi-term query coverage & exact phrase/identifier hit
    const coverageRatio = matchedSubstantiveTerms.length / substantiveTerms.length;
    score *= 0.6 + 0.75 * coverageRatio;

    const sectionNorm = normalizeSearchText(doc.chunk.section);
    if (sectionNorm.length >= 4 && normalizedQuery.includes(sectionNorm)) {
      score += 2.2;
    }

    if (options.bodyHint && normalizeSearchText(doc.chunk.title + ' ' + doc.chunk.text).includes(options.bodyHint)) {
      score += 0.35;
    }

    scored.push({
      chunk: doc.chunk,
      score: Number(score.toFixed(4)),
      matchedTerms,
      matchedSubstantiveTerms,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
  const matches = scored.slice(0, topK);
  const topScore = matches[0]?.score ?? 0;

  // Require strong BM25 score and >= 50% substantive-term coverage on multi-term questions
  const topMatched = matches[0]?.matchedSubstantiveTerms.length ?? 0;
  const topCoverageRatio = topMatched / substantiveTerms.length;
  const topCoverageOk =
    substantiveTerms.length <= 2
      ? topMatched >= 1
      : topMatched >= 2 && topCoverageRatio >= 0.5;

  const sufficient = topScore >= minScore && topCoverageOk;

  return {
    sufficient,
    topScore,
    queryTerms,
    substantiveTerms,
    matches,
  };
}
