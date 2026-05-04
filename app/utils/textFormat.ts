export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Display / export label: "Name (Designation)" when designation is non-empty. */
export function formatTechnicianNameWithDesignation(name: string, designation?: string | null): string {
  const trimmedName = name?.trim() ?? '';
  const d = designation?.trim();
  if (!trimmedName) return '';
  return d ? `${trimmedName} (${d})` : trimmedName;
}

export function toUpperNormalized(value: string): string {
  return normalizeSpaces(value).toUpperCase();
}

export function toSentenceCase(value: string): string {
  const normalized = normalizeSpaces(value);
  if (!normalized) return '';

  return applySentencePunctuation(applySentenceCase(applyCommonCorrections(normalized.toLowerCase())));
}

export function toSentenceCaseLive(value: string): string {
  if (!value) return '';

  const corrected = applyCommonCorrections(value.toLowerCase());

  return applySentenceCase(corrected);
}

export function toPresentTenseText(value: string): string {
  const normalized = normalizeSpaces(value);
  if (!normalized) return '';

  const corrected = applyCommonCorrections(normalized.toLowerCase());
  const presentTense = corrected
    .replace(/\bwas\b/g, 'is')
    .replace(/\bwere\b/g, 'are')
    .replace(/\bhas been\b/g, 'is')
    .replace(/\bhad been\b/g, 'is')
    .replace(/\bdid\b/g, 'does');

  return applySentencePunctuation(applySentenceCase(presentTense));
}

export function toPresentTenseTextLive(value: string): string {
  if (!value) return '';
  const corrected = applyCommonCorrections(value.toLowerCase())
    .replace(/\bwas\b/g, 'is')
    .replace(/\bwere\b/g, 'are')
    .replace(/\bhas been\b/g, 'is')
    .replace(/\bhad been\b/g, 'is')
    .replace(/\bdid\b/g, 'does');
  return applySentenceCase(corrected);
}

export function toPastTenseText(value: string): string {
  const normalized = normalizeSpaces(value);
  if (!normalized) return '';

  const corrected = applyCommonCorrections(normalized.toLowerCase());
  const pastTense = corrected
    .replace(/\bis done\b/g, 'was done')
    .replace(/\bis repaired\b/g, 'was repaired')
    .replace(/\bis replaced\b/g, 'was replaced')
    .replace(/\bis fixed\b/g, 'was fixed');

  return applySentencePunctuation(applySentenceCase(pastTense));
}

export function toPastTenseTextLive(value: string): string {
  if (!value) return '';
  const corrected = applyCommonCorrections(value.toLowerCase())
    .replace(/\bis done\b/g, 'was done')
    .replace(/\bis repaired\b/g, 'was repaired')
    .replace(/\bis replaced\b/g, 'was replaced')
    .replace(/\bis fixed\b/g, 'was fixed');
  return applySentenceCase(corrected);
}

function applyCommonCorrections(value: string): string {
  return value
    .replace(/\bwat(?=\b|\s|$)/g, 'what')
    .replace(/\bwhats(?=\b|\s|$)/g, "what's")
    .replace(/\bproblm(?=\b|\s|$)/g, 'problem')
    .replace(/\bprobelm(?=\b|\s|$)/g, 'problem')
    .replace(/\bteh(?=\b|\s|$)/g, 'the')
    .replace(/\brecieve(?=\b|\s|$)/g, 'receive')
    .replace(/\bdont(?=\b|\s|$)/g, "don't")
    .replace(/\bcant(?=\b|\s|$)/g, "can't")
    .replace(/\bwont(?=\b|\s|$)/g, "won't")
    .replace(/\bto be fabricate(?=\b|\s|$)/g, 'to be fabricated')
    .replace(/\bbe fabricate(?=\b|\s|$)/g, 'be fabricated')
    .replace(/\bfloor pot stand(?=\b|\s|$)/g, 'a floor pot stand')
    .replace(/\bwelding done(?=\b|\s|$)/g, 'welding was done')
    .replace(/\bpaint done(?=\b|\s|$)/g, 'painting was done')
    .replace(/\bgreasing done(?=\b|\s|$)/g, 'greasing was done')
    .replace(/\btighten done(?=\b|\s|$)/g, 'tightening was done')
    .replace(/\breplace done(?=\b|\s|$)/g, 'replacement was done')
    .replace(/\bservice done(?=\b|\s|$)/g, 'servicing was done')
    .replace(/\breplace\b(?=\s+(the|a|an)\b)/g, 'replaced')
    .replace(/\bfix\b(?=\s+(the|a|an)\b)/g, 'fixed')
    .replace(/\bclean\b(?=\s+(the|a|an)\b)/g, 'cleaned')
    .replace(/\bcheck\b(?=\s+(the|a|an)\b)/g, 'checked')
    .replace(/\bchange\b(?=\s+(the|a|an)\b)/g, 'changed')
    .replace(/\b(a|an)\s+(a|an)\b/g, '$1')
    .replace(/\s{2,}/g, ' ');
}

function applySentenceCase(value: string): string {
  return value.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase());
}

function applySentencePunctuation(value: string): string {
  if (/^what\s+(is|was|are|were|did|do|does)\b/i.test(value) && !/[.!?]$/.test(value)) {
    return `${value}?`;
  }
  return value;
}
