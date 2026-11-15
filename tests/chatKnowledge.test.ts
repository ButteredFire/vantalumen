import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CHAT_KNOWLEDGE_INDEX,
  normalizeSearchText,
  searchKnowledgeChunks,
} from '../src/chat/knowledgeRetriever';

test('local knowledge index is reproducible, non-empty, and includes required metadata fields', () => {
  assert.equal(CHAT_KNOWLEDGE_INDEX.version, '1.0.0');
  assert.match(CHAT_KNOWLEDGE_INDEX.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(CHAT_KNOWLEDGE_INDEX.chunks.length >= 40);
  assert.equal(CHAT_KNOWLEDGE_INDEX.chunkCount, CHAT_KNOWLEDGE_INDEX.chunks.length);

  const ids = new Set<string>();
  for (const chunk of CHAT_KNOWLEDGE_INDEX.chunks) {
    assert.ok(chunk.id && !ids.has(chunk.id), `Duplicate or empty chunk ID: ${chunk.id}`);
    ids.add(chunk.id);
    assert.ok(chunk.title.length > 0);
    assert.ok(chunk.sourcePath.length > 0);
    assert.ok(chunk.section.length > 0);
    assert.ok(chunk.text.length > 0);
    assert.ok(['vi', 'en', 'mixed'].includes(chunk.language));
    assert.ok(
      ['documentation', 'catalog', 'dossier', 'simulation', 'control_spec', 'mission', 'provenance'].includes(
        chunk.sourceKind,
      ),
    );
    assert.ok(
      ['source_verified', 'illustrative_or_simulated', 'mixed', 'policy'].includes(chunk.evidenceType),
    );
  }
});

test('Vietnamese diacritic folding and BM25 retriever find accurate grounded chunks with citations', () => {
  assert.equal(normalizeSearchText('Mặt Trăng · Tàu đổ bộ'), 'mat trang · tau do bo');

  const lmResult = searchKnowledgeChunks('Apollo Lunar Module GLB do ai tạo credit và SHA256 là gì');
  assert.equal(lmResult.sufficient, true);
  assert.ok(
    lmResult.matches.some((m) => m.chunk.id === 'device_apollo_lunar_module'),
    'Expected Apollo Lunar Module dossier/manifest chunk',
  );
  const lmTop = lmResult.matches.find((m) => m.chunk.id === 'device_apollo_lunar_module')!;
  assert.match(lmTop.chunk.text, /Michael D\. Carbajal/);
  assert.match(lmTop.chunk.text, /379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e/);
  assert.ok(lmTop.chunk.sourceUrls.includes('https://science.nasa.gov/3d-resources/apollo-lunar-module/'));

  const ingenuityResult = searchKnowledgeChunks('Trực thăng Ingenuity nặng bao nhiêu kg và điều khiển thế nào');
  assert.equal(ingenuityResult.sufficient, true);
  assert.ok(
    ingenuityResult.matches.some((m) => m.chunk.id === 'device_ingenuity_helicopter'),
    'Expected Ingenuity chunk',
  );

  const terrainResult = searchKnowledgeChunks('địa hình Mặt Trăng LOLA Diviner có phải đo đạc thật không');
  assert.equal(terrainResult.sufficient, true);
  assert.ok(
    terrainResult.matches.some(
      (m) => m.chunk.id === 'body_moon' || m.chunk.sourcePath.includes('SOURCES.md'),
    ),
  );

  const nonMarsResult = searchKnowledgeChunks('vì sao Pioneer 10 và Kepler tách khỏi catalog Sao Hỏa');
  assert.equal(nonMarsResult.sufficient, true);
  assert.ok(
    nonMarsResult.matches.some(
      (m) =>
        m.chunk.id === 'device_pioneer_10' ||
        m.chunk.id === 'device_kepler_space_telescope' ||
        m.chunk.sourcePath.includes('SOURCES.md'),
    ),
  );

  // Unaccented queries and concise 2-term queries also resolve cleanly
  const unaccented = searchKnowledgeChunks('Apollo Lunar Module do ai tao SHA256');
  assert.equal(unaccented.sufficient, true);
  assert.equal(unaccented.matches[0]?.chunk.id, 'device_apollo_lunar_module');

  const shortQuery = searchKnowledgeChunks('Ingenuity rotor');
  assert.equal(shortQuery.sufficient, true);
  assert.ok(
    shortQuery.matches.some((m) => m.chunk.id === 'device_ingenuity_helicopter'),
  );
});

test('ungrounded out-of-scope queries return sufficient=false and index never embeds secrets', () => {
  const pricing = searchKnowledgeChunks('giá cổ phiếu SpaceX niêm yết sàn NASDAQ hôm nay bao nhiêu');
  assert.equal(pricing.sufficient, false);

  const unrelatedRecipe = searchKnowledgeChunks('cách nấu phở bò Hà Nội chuẩn vị bằng nồi áp suất');
  assert.equal(unrelatedRecipe.sufficient, false);

  const indexRaw = fs.readFileSync(
    path.resolve(process.cwd(), 'src/config/chatKnowledgeIndex.json'),
    'utf8',
  );
  assert.doesNotMatch(indexRaw, /AQ\.Ab8RN6|AIzaSy/i);
});
