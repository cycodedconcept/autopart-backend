const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'em',
  'figcaption',
  'figure',
  'h2',
  'h3',
  'h4',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'strong',
  'u',
  'ul'
]);
const SELF_CLOSING_TAGS = new Set(['br', 'hr', 'img']);
const STRIP_ENTIRE_TAGS_PATTERN = /<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const TAG_PATTERN = /<\/?([a-z0-9]+)([^>]*)>/gi;
const ATTRIBUTE_PATTERN = /([a-z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const WORDS_PER_MINUTE = 200;

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function decodeHtmlEntity(entity) {
  switch (entity) {
    case '&nbsp;':
      return ' ';
    case '&amp;':
      return '&';
    case '&lt;':
      return '<';
    case '&gt;':
      return '>';
    case '&quot;':
      return '"';
    case '&#39;':
      return '\'';
    default:
      return ' ';
  }
}

function stripHtml(value) {
  return String(value || '')
    .replace(STRIP_ENTIRE_TAGS_PATTERN, ' ')
    .replace(COMMENT_PATTERN, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (match) => decodeHtmlEntity(match))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readAttributes(rawAttributes = '') {
  const attributes = new Map();
  let match;

  while ((match = ATTRIBUTE_PATTERN.exec(rawAttributes)) !== null) {
    const attributeName = String(match[1] || '').toLowerCase();
    const attributeValue = match[3] || match[4] || match[5] || '';

    attributes.set(attributeName, attributeValue);
  }

  ATTRIBUTE_PATTERN.lastIndex = 0;

  return attributes;
}

function isSafeUrl(value) {
  if (!value) {
    return false;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue.startsWith('//')) {
    return false;
  }

  return (
    normalizedValue.startsWith('http://')
    || normalizedValue.startsWith('https://')
    || normalizedValue.startsWith('/')
  );
}

function isExternalHref(href) {
  return /^https?:\/\//i.test(String(href || '').trim());
}

function sanitizeAnchorTag(attributes) {
  const href = attributes.get('href');

  if (!isSafeUrl(href)) {
    return '<a>';
  }

  const sanitizedAttributes = [`href="${escapeHtmlAttribute(href)}"`];

  if (isExternalHref(href)) {
    sanitizedAttributes.push('rel="noopener noreferrer"');
  }

  return `<a ${sanitizedAttributes.join(' ')}>`;
}

function sanitizeImageTag(attributes) {
  const src = attributes.get('src');

  if (!isSafeUrl(src)) {
    return '';
  }

  const sanitizedAttributes = [`src="${escapeHtmlAttribute(src)}"`];
  const alt = attributes.get('alt');

  if (alt !== undefined) {
    sanitizedAttributes.push(`alt="${escapeHtmlAttribute(alt)}"`);
  }

  return `<img ${sanitizedAttributes.join(' ')}>`;
}

function sanitizeTag(match, rawTagName, rawAttributes) {
  const tagName = String(rawTagName || '').toLowerCase();
  const isClosingTag = match.startsWith('</');

  if (!ALLOWED_TAGS.has(tagName)) {
    return '';
  }

  if (isClosingTag) {
    return SELF_CLOSING_TAGS.has(tagName) ? '' : `</${tagName}>`;
  }

  if (tagName === 'a') {
    return sanitizeAnchorTag(readAttributes(rawAttributes));
  }

  if (tagName === 'img') {
    return sanitizeImageTag(readAttributes(rawAttributes));
  }

  if (SELF_CLOSING_TAGS.has(tagName)) {
    return `<${tagName}>`;
  }

  return `<${tagName}>`;
}

function sanitizeBlogHtml(value) {
  return String(value || '')
    .replace(STRIP_ENTIRE_TAGS_PATTERN, '')
    .replace(COMMENT_PATTERN, '')
    .replace(TAG_PATTERN, sanitizeTag)
    .replace(/\s+\n/g, '\n')
    .trim();
}

function deriveExcerptFromHtml(html, maxLength = 200) {
  const plainText = stripHtml(html);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  const truncatedText = plainText.slice(0, maxLength);
  const lastSpaceIndex = truncatedText.lastIndexOf(' ');
  const safeExcerpt = lastSpaceIndex >= 120
    ? truncatedText.slice(0, lastSpaceIndex)
    : truncatedText;

  return `${safeExcerpt.trim()}...`;
}

function computeReadTimeMinutes(html) {
  const plainText = stripHtml(html);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

module.exports = {
  computeReadTimeMinutes,
  deriveExcerptFromHtml,
  sanitizeBlogHtml,
  slugify,
  stripHtml
};
