require('../../setup/jest');

const {
  getPublicBlogPostBySlugSchema,
  listFeaturedBlogListingsSchema,
  listPublicBlogCommentsSchema,
  listPublicBlogPostsSchema,
  listRelatedPublicBlogPostsSchema,
  recordPublicBlogPostViewSchema,
  submitPublicBlogCommentSchema
} = require('../../../src/validators/blog.validator');

describe('blog validator', () => {
  it('accepts a valid public blog list query', () => {
    const { error, value } = listPublicBlogPostsSchema.validate({
      body: {},
      params: {},
      query: {
        category: 'diagnostics',
        tag: 'fuel-system',
        search: 'fuel pump',
        sort: 'oldest',
        page: '2',
        per_page: '12'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      category: 'diagnostics',
      tag: 'fuel-system',
      search: 'fuel pump',
      sort: 'oldest',
      page: 2,
      per_page: 12
    });
  });

  it('rejects a page size larger than the supported maximum', () => {
    const { error } = listPublicBlogPostsSchema.validate({
      body: {},
      params: {},
      query: {
        per_page: 51
      }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"query.per_page"');
  });

  it('rejects an unsupported blog sort value', () => {
    const { error } = listPublicBlogPostsSchema.validate({
      body: {},
      params: {},
      query: {
        sort: 'popular'
      }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"query.sort"');
  });

  it('accepts a blog slug on the detail and related routes', () => {
    const detail = getPublicBlogPostBySlugSchema.validate({
      body: {},
      params: {
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      },
      query: {}
    });
    const related = listRelatedPublicBlogPostsSchema.validate({
      body: {},
      params: {
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      },
      query: {}
    });

    expect(detail.error).toBeUndefined();
    expect(related.error).toBeUndefined();
    expect(detail.value.params.slug).toBe('how-to-know-when-brake-pads-need-immediate-replacement');
    expect(related.value.params.slug).toBe('how-to-know-when-brake-pads-need-immediate-replacement');
  });

  it('accepts comment-list and view slugs on public post actions', () => {
    const comments = listPublicBlogCommentsSchema.validate({
      body: {},
      params: {
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      },
      query: {}
    });
    const view = recordPublicBlogPostViewSchema.validate({
      body: {},
      params: {
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      },
      query: {}
    });

    expect(comments.error).toBeUndefined();
    expect(view.error).toBeUndefined();
  });

  it('accepts the featured listings blog sidebar route envelope', () => {
    const { error } = listFeaturedBlogListingsSchema.validate({
      body: {},
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid public blog comment payload', () => {
    const { error, value } = submitPublicBlogCommentSchema.validate({
      body: {
        authorName: 'Bose Akin',
        authorEmail: 'BOSE.AKIN@example.com',
        body: 'This explanation was very helpful.',
        parentId: 8401,
        website: ''
      },
      params: {
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body).toEqual({
      authorName: 'Bose Akin',
      authorEmail: 'bose.akin@example.com',
      body: 'This explanation was very helpful.',
      parentId: 8401,
      website: ''
    });
  });

  it('rejects an oversized public blog comment body', () => {
    const { error } = submitPublicBlogCommentSchema.validate({
      body: {
        authorName: 'Bose Akin',
        authorEmail: 'bose.akin@example.com',
        body: 'a'.repeat(2001)
      },
      params: {
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"body.body"');
  });
});
