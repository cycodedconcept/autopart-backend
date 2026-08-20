require('../../setup/jest');

const {
  sanitizeBlogHtml
} = require('../../../src/utils/blog-content');

describe('blog content utils', () => {
  it('forces rel attributes on external links and strips unsupported attributes', () => {
    const sanitized = sanitizeBlogHtml(
      '<p><a href="https://parts.example.com/deals" target="_blank" onclick="alert(1)">Deals</a></p>'
    );

    expect(sanitized).toBe(
      '<p><a href="https://parts.example.com/deals" rel="noopener noreferrer">Deals</a></p>'
    );
  });

  it('rejects protocol-relative URLs in anchor and image tags', () => {
    const sanitized = sanitizeBlogHtml(
      '<p><a href="//evil.example/phish">Bad Link</a><img src="//evil.example/pixel.png" alt="tracker"></p>'
    );

    expect(sanitized).toBe('<p><a>Bad Link</a></p>');
  });
});
