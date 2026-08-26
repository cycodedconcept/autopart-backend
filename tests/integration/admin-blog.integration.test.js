require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { ADMIN_PERMISSION_KEYS } = require('../../src/config/constants');

const { expect } = chai;

const FULL_ADMIN_PERMISSIONS = Object.values(ADMIN_PERMISSION_KEYS);

function buildBlogCategory(overrides = {}) {
  return {
    id: 7101,
    name: 'Diagnostics',
    slug: 'diagnostics',
    description: 'Finding faults quickly in the workshop.',
    status: 'active',
    postCount: 4,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    ...overrides
  };
}

function buildBlogTag(overrides = {}) {
  return {
    id: 7201,
    name: 'Fuel System',
    slug: 'fuel-system',
    status: 'active',
    postCount: 3,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    ...overrides
  };
}

function buildBlogPost(overrides = {}) {
  const category = overrides.category || buildBlogCategory();

  return {
    id: 7301,
    categoryId: category.id,
    category,
    title: 'Fuel Filter Warning Signs',
    slug: 'fuel-filter-warning-signs',
    excerpt: 'A clogged fuel filter can cause hesitation, hard starts, and weak acceleration.',
    body: '<p>A clogged fuel filter can cause hesitation, hard starts, and weak acceleration.</p>',
    featuredImageUrl: 'https://images.example.com/blog/fuel-filter-warning-signs.jpg',
    featuredImageAlt: 'Mechanic replacing a clogged fuel filter',
    authorDisplayName: 'Aisha Bello',
    authorAvatarUrl: 'https://images.example.com/authors/aisha-bello.jpg',
    readTimeMinutes: 1,
    status: 'draft',
    publishedAt: null,
    viewCount: 18,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    tags: [
      buildBlogTag(),
      buildBlogTag({
        id: 7202,
        name: 'Maintenance',
        slug: 'maintenance'
      })
    ],
    commentCount: 2,
    ...overrides
  };
}

function buildBlogComment(overrides = {}) {
  return {
    id: 7401,
    postId: 7301,
    parentId: null,
    authorName: 'Bose Akin',
    authorEmail: 'bose.akin@example.com',
    body: 'This helped me narrow down a fuel delivery issue quickly.',
    status: 'pending',
    approvedAt: null,
    createdAt: '2026-08-02T09:15:00.000Z',
    updatedAt: '2026-08-02T09:15:00.000Z',
    ...overrides
  };
}

function buildNewsletterSubscriber(overrides = {}) {
  return {
    id: 7501,
    email: 'reader@example.com',
    status: 'subscribed',
    subscribedAt: '2026-08-01T08:00:00.000Z',
    unsubscribedAt: null,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    ...overrides
  };
}

function createAdminServiceStub({ permissions = FULL_ADMIN_PERMISSIONS } = {}) {
  const calls = {};

  const adminService = {
    getAuthenticatedAdmin: async (token) => {
      calls.getAuthenticatedAdmin = token;

      return {
        id: 9001,
        email: 'editor@autoparts.local',
        permissions
      };
    },

    listBlogCategories: async (payload) => {
      calls.listBlogCategories = payload;

      return {
        categories: [buildBlogCategory()],
        filters: payload.query
      };
    },

    getBlogCategory: async (payload) => {
      calls.getBlogCategory = payload;
      return buildBlogCategory({
        id: payload.categoryId
      });
    },

    createBlogCategory: async (payload) => {
      calls.createBlogCategory = payload;
      return buildBlogCategory({
        id: 7102,
        name: payload.name,
        slug: payload.slug || 'maintenance-guides',
        description: payload.description || null,
        status: payload.status || 'active'
      });
    },

    updateBlogCategory: async (payload) => {
      calls.updateBlogCategory = payload;
      return buildBlogCategory({
        id: payload.categoryId,
        name: payload.name || 'Updated Diagnostics',
        slug: payload.slug || 'updated-diagnostics',
        description: payload.description || 'Updated description.',
        status: payload.status || 'active'
      });
    },

    deleteBlogCategory: async (payload) => {
      calls.deleteBlogCategory = payload;
      return buildBlogCategory({
        id: payload.categoryId,
        status: 'archived'
      });
    },

    listBlogTags: async (payload) => {
      calls.listBlogTags = payload;

      return {
        tags: [buildBlogTag()],
        filters: payload.query
      };
    },

    getBlogTag: async (payload) => {
      calls.getBlogTag = payload;
      return buildBlogTag({
        id: payload.tagId
      });
    },

    createBlogTag: async (payload) => {
      calls.createBlogTag = payload;
      return buildBlogTag({
        id: 7203,
        name: payload.name,
        slug: payload.slug || 'brake-care',
        status: payload.status || 'active'
      });
    },

    updateBlogTag: async (payload) => {
      calls.updateBlogTag = payload;
      return buildBlogTag({
        id: payload.tagId,
        name: payload.name || 'Updated Tag',
        slug: payload.slug || 'updated-tag',
        status: payload.status || 'active'
      });
    },

    deleteBlogTag: async (payload) => {
      calls.deleteBlogTag = payload;
      return buildBlogTag({
        id: payload.tagId,
        status: 'archived'
      });
    },

    listBlogPosts: async (payload) => {
      calls.listBlogPosts = payload;

      return {
        posts: [
          {
            id: 7301,
            categoryId: 7101,
            category: buildBlogCategory(),
            title: 'Fuel Filter Warning Signs',
            slug: 'fuel-filter-warning-signs',
            excerpt: 'A clogged fuel filter can cause hesitation, hard starts, and weak acceleration.',
            featuredImageUrl: 'https://images.example.com/blog/fuel-filter-warning-signs.jpg',
            featuredImageAlt: 'Mechanic replacing a clogged fuel filter',
            authorDisplayName: 'Aisha Bello',
            authorAvatarUrl: 'https://images.example.com/authors/aisha-bello.jpg',
            readTimeMinutes: 1,
            status: 'published',
            publishedAt: '2026-08-10T09:00:00.000Z',
            viewCount: 18,
            createdAt: '2026-08-01T08:00:00.000Z',
            updatedAt: '2026-08-10T09:00:00.000Z'
          }
        ],
        pagination: {
          page: payload.query.page,
          limit: payload.query.limit,
          total: 1,
          totalPages: 1
        },
        filters: {
          status: payload.query.status,
          categoryId: payload.query.categoryId || null,
          search: payload.query.search || null,
          sort: payload.query.sort
        }
      };
    },

    getBlogPost: async (payload) => {
      calls.getBlogPost = payload;
      return buildBlogPost({
        id: payload.postId
      });
    },

    createBlogPost: async (payload) => {
      calls.createBlogPost = payload;
      return buildBlogPost({
        id: 7302,
        categoryId: payload.categoryId,
        title: payload.title,
        slug: payload.slug || 'fuel-pump-warning-signs',
        excerpt: payload.excerpt || 'A weak fuel pump often shows up as hard starts and hesitation under load.',
        body: payload.body,
        featuredImageUrl: payload.featuredImageUrl || null,
        featuredImageAlt: payload.featuredImageAlt || null,
        authorDisplayName: payload.authorDisplayName,
        authorAvatarUrl: payload.authorAvatarUrl || null,
        status: payload.status || 'draft',
        publishedAt: payload.status === 'published' ? payload.publishedAt : null,
        tags: (payload.tagIds || []).map((tagId) => buildBlogTag({
          id: tagId,
          name: tagId === 7201 ? 'Fuel System' : `Tag ${tagId}`,
          slug: tagId === 7201 ? 'fuel-system' : `tag-${tagId}`
        }))
      });
    },

    updateBlogPost: async (payload) => {
      calls.updateBlogPost = payload;
      return buildBlogPost({
        id: payload.postId,
        categoryId: payload.categoryId || 7101,
        title: payload.title || 'Updated Blog Post',
        slug: payload.slug || 'updated-blog-post',
        excerpt: payload.excerpt || 'Updated excerpt',
        body: payload.body || '<p>Updated body content for the article.</p>',
        featuredImageUrl: payload.featuredImageUrl || null,
        featuredImageAlt: payload.featuredImageAlt || null,
        authorDisplayName: payload.authorDisplayName || 'Updated Author',
        authorAvatarUrl: payload.authorAvatarUrl || null,
        publishedAt: payload.publishedAt || null,
        tags: (payload.tagIds || []).map((tagId) => buildBlogTag({
          id: tagId,
          name: `Tag ${tagId}`,
          slug: `tag-${tagId}`
        }))
      });
    },

    publishBlogPost: async (payload) => {
      calls.publishBlogPost = payload;
      return buildBlogPost({
        id: payload.postId,
        status: 'published',
        publishedAt: payload.publishedAt || '2026-08-20T09:00:00.000Z'
      });
    },

    unpublishBlogPost: async (payload) => {
      calls.unpublishBlogPost = payload;
      return buildBlogPost({
        id: payload.postId,
        status: 'draft',
        publishedAt: null
      });
    },

    deleteBlogPost: async (payload) => {
      calls.deleteBlogPost = payload;
      return buildBlogPost({
        id: payload.postId,
        status: 'archived'
      });
    },

    listBlogComments: async (payload) => {
      calls.listBlogComments = payload;

      return {
        comments: [buildBlogComment()],
        pagination: {
          page: payload.query.page,
          limit: payload.query.limit,
          total: 1,
          totalPages: 1
        },
        filters: {
          postId: payload.query.postId || null,
          status: payload.query.status,
          search: payload.query.search || null
        }
      };
    },

    updateBlogComment: async (payload) => {
      calls.updateBlogComment = payload;
      return buildBlogComment({
        id: payload.commentId,
        status: payload.status,
        approvedAt: payload.status === 'approved' ? '2026-08-20T10:00:00.000Z' : null
      });
    },

    listNewsletterSubscribers: async (payload) => {
      calls.listNewsletterSubscribers = payload;

      return {
        subscribers: [
          buildNewsletterSubscriber(),
          buildNewsletterSubscriber({
            id: 7502,
            email: 'former-reader@example.com',
            status: 'unsubscribed',
            unsubscribedAt: '2026-08-10T09:00:00.000Z'
          })
        ],
        pagination: {
          page: payload.query.page,
          limit: payload.query.limit,
          total: 2,
          totalPages: 1
        },
        filters: {
          status: payload.query.status,
          search: payload.query.search || null
        }
      };
    },

    exportNewsletterSubscribersCsv: async (payload) => {
      calls.exportNewsletterSubscribersCsv = payload;

      return {
        filename: 'newsletter-subscribers-2026-08-21.csv',
        csv: [
          'Email,Status,Subscribed At,Unsubscribed At,Created At',
          'reader@example.com,subscribed,2026-08-01T08:00:00.000Z,,2026-08-01T08:00:00.000Z',
          'former-reader@example.com,unsubscribed,2026-08-01T08:00:00.000Z,2026-08-10T09:00:00.000Z,2026-08-01T08:00:00.000Z'
        ].join('\n')
      };
    }
  };

  return { adminService, calls };
}

function buildTestApp(options = {}) {
  const { adminService, calls } = createAdminServiceStub(options);
  const app = createApp({ adminService });

  return { app, calls };
}

describe('Admin blog API integration samples', () => {
  it('lists, creates, reads, updates, and archives blog categories through admin routes', async () => {
    const { app, calls } = buildTestApp();

    const listResponse = await request(app)
      .get('/api/v1/admin/blog/categories')
      .set('Authorization', 'Bearer admin-token')
      .query({
        status: 'active',
        search: 'diag'
      });

    expect(listResponse.status).to.equal(200);
    expect(listResponse.body.success).to.equal(true);
    expect(listResponse.body.data.categories[0].slug).to.equal('diagnostics');
    expect(calls.listBlogCategories.query).to.deep.equal({
      status: 'active',
      search: 'diag'
    });

    const createResponse = await request(app)
      .post('/api/v1/admin/blog/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Maintenance Guides',
        description: 'Routine service and workshop advice.'
      });

    expect(createResponse.status).to.equal(201);
    expect(createResponse.body.message).to.equal('Blog category created successfully.');
    expect(createResponse.body.data.name).to.equal('Maintenance Guides');
    expect(calls.createBlogCategory).to.deep.equal({
      adminId: 9001,
      name: 'Maintenance Guides',
      slug: undefined,
      description: 'Routine service and workshop advice.',
      status: undefined
    });

    const detailResponse = await request(app)
      .get('/api/v1/admin/blog/categories/7101')
      .set('Authorization', 'Bearer admin-token');

    expect(detailResponse.status).to.equal(200);
    expect(detailResponse.body.data.id).to.equal(7101);
    expect(calls.getBlogCategory).to.deep.equal({
      categoryId: 7101
    });

    const updateResponse = await request(app)
      .patch('/api/v1/admin/blog/categories/7101')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Workshop Diagnostics',
        slug: 'workshop-diagnostics',
        status: 'active'
      });

    expect(updateResponse.status).to.equal(200);
    expect(updateResponse.body.data.slug).to.equal('workshop-diagnostics');
    expect(calls.updateBlogCategory).to.deep.equal({
      adminId: 9001,
      categoryId: 7101,
      name: 'Workshop Diagnostics',
      slug: 'workshop-diagnostics',
      description: undefined,
      status: 'active'
    });

    const deleteResponse = await request(app)
      .delete('/api/v1/admin/blog/categories/7101')
      .set('Authorization', 'Bearer admin-token');

    expect(deleteResponse.status).to.equal(200);
    expect(deleteResponse.body.data.status).to.equal('archived');
    expect(calls.deleteBlogCategory).to.deep.equal({
      adminId: 9001,
      categoryId: 7101
    });
  });

  it('lists, creates, reads, updates, and archives blog tags through admin routes', async () => {
    const { app, calls } = buildTestApp();

    const listResponse = await request(app)
      .get('/api/v1/admin/blog/tags')
      .set('Authorization', 'Bearer admin-token')
      .query({
        status: 'active',
        search: 'fuel'
      });

    expect(listResponse.status).to.equal(200);
    expect(listResponse.body.data.tags[0].slug).to.equal('fuel-system');
    expect(calls.listBlogTags.query).to.deep.equal({
      status: 'active',
      search: 'fuel'
    });

    const createResponse = await request(app)
      .post('/api/v1/admin/blog/tags')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Brake Care'
      });

    expect(createResponse.status).to.equal(201);
    expect(createResponse.body.data.slug).to.equal('brake-care');
    expect(calls.createBlogTag).to.deep.equal({
      adminId: 9001,
      name: 'Brake Care',
      slug: undefined,
      status: undefined
    });

    const detailResponse = await request(app)
      .get('/api/v1/admin/blog/tags/7201')
      .set('Authorization', 'Bearer admin-token');

    expect(detailResponse.status).to.equal(200);
    expect(detailResponse.body.data.id).to.equal(7201);
    expect(calls.getBlogTag).to.deep.equal({
      tagId: 7201
    });

    const updateResponse = await request(app)
      .patch('/api/v1/admin/blog/tags/7201')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Fuel Delivery',
        slug: 'fuel-delivery'
      });

    expect(updateResponse.status).to.equal(200);
    expect(updateResponse.body.data.slug).to.equal('fuel-delivery');
    expect(calls.updateBlogTag).to.deep.equal({
      adminId: 9001,
      tagId: 7201,
      name: 'Fuel Delivery',
      slug: 'fuel-delivery',
      status: undefined
    });

    const deleteResponse = await request(app)
      .delete('/api/v1/admin/blog/tags/7201')
      .set('Authorization', 'Bearer admin-token');

    expect(deleteResponse.status).to.equal(200);
    expect(deleteResponse.body.data.status).to.equal('archived');
    expect(calls.deleteBlogTag).to.deep.equal({
      adminId: 9001,
      tagId: 7201
    });
  });

  it('lists, creates, reads, updates, publishes, unpublishes, and archives blog posts', async () => {
    const { app, calls } = buildTestApp();

    const listResponse = await request(app)
      .get('/api/v1/admin/blog/posts')
      .set('Authorization', 'Bearer admin-token')
      .query({
        status: 'published',
        categoryId: 7101,
        search: 'fuel pump',
        sort: 'oldest',
        page: 2,
        limit: 5
      });

    expect(listResponse.status).to.equal(200);
    expect(listResponse.body.data.posts).to.have.length(1);
    expect(listResponse.body.data.pagination).to.deep.equal({
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1
    });
    expect(calls.listBlogPosts.query).to.deep.equal({
      status: 'published',
      categoryId: 7101,
      search: 'fuel pump',
      sort: 'oldest',
      page: 2,
      limit: 5,
      offset: 5
    });

    const createResponse = await request(app)
      .post('/api/v1/admin/blog/posts')
      .set('Authorization', 'Bearer admin-token')
      .send({
        categoryId: 7101,
        title: 'Fuel Pump Warning Signs',
        body: '<p>A weak fuel pump often shows up as hard starts and hesitation under load.</p>',
        authorDisplayName: 'Aisha Bello',
        tagIds: [7201, 7202],
        status: 'draft'
      });

    expect(createResponse.status).to.equal(201);
    expect(createResponse.body.data.title).to.equal('Fuel Pump Warning Signs');
    expect(createResponse.body.data.tags).to.have.length(2);
    expect(calls.createBlogPost).to.deep.equal({
      adminId: 9001,
      categoryId: 7101,
      title: 'Fuel Pump Warning Signs',
      slug: undefined,
      excerpt: undefined,
      body: '<p>A weak fuel pump often shows up as hard starts and hesitation under load.</p>',
      featuredImageUrl: undefined,
      featuredImageAlt: undefined,
      authorDisplayName: 'Aisha Bello',
      authorAvatarUrl: undefined,
      status: 'draft',
      publishedAt: undefined,
      tagIds: [7201, 7202]
    });

    const detailResponse = await request(app)
      .get('/api/v1/admin/blog/posts/7301')
      .set('Authorization', 'Bearer admin-token');

    expect(detailResponse.status).to.equal(200);
    expect(detailResponse.body.data.body).to.contain('clogged fuel filter');
    expect(calls.getBlogPost).to.deep.equal({
      postId: 7301
    });

    const updateResponse = await request(app)
      .patch('/api/v1/admin/blog/posts/7301')
      .set('Authorization', 'Bearer admin-token')
      .send({
        title: 'Updated Fuel Filter Warning Signs',
        slug: 'updated-fuel-filter-warning-signs',
        excerpt: 'Updated excerpt for the maintenance article.',
        body: '<p>Updated body content for the fuel filter article.</p>',
        authorDisplayName: 'Kunle Adebayo',
        allowSlugOverride: true,
        tagIds: [7202]
      });

    expect(updateResponse.status).to.equal(200);
    expect(updateResponse.body.data.slug).to.equal('updated-fuel-filter-warning-signs');
    expect(calls.updateBlogPost).to.deep.equal({
      adminId: 9001,
      postId: 7301,
      categoryId: undefined,
      title: 'Updated Fuel Filter Warning Signs',
      slug: 'updated-fuel-filter-warning-signs',
      excerpt: 'Updated excerpt for the maintenance article.',
      body: '<p>Updated body content for the fuel filter article.</p>',
      featuredImageUrl: undefined,
      featuredImageAlt: undefined,
      authorDisplayName: 'Kunle Adebayo',
      authorAvatarUrl: undefined,
      publishedAt: undefined,
      tagIds: [7202],
      allowSlugOverride: true
    });

    const publishResponse = await request(app)
      .post('/api/v1/admin/blog/posts/7301/publish')
      .set('Authorization', 'Bearer admin-token')
      .send({
        publishedAt: '2026-08-20T09:00:00.000Z'
      });

    expect(publishResponse.status).to.equal(200);
    expect(publishResponse.body.data.status).to.equal('published');
    expect(calls.publishBlogPost.adminId).to.equal(9001);
    expect(calls.publishBlogPost.postId).to.equal(7301);
    expect(calls.publishBlogPost.publishedAt).to.be.instanceOf(Date);
    expect(calls.publishBlogPost.publishedAt.toISOString()).to.equal('2026-08-20T09:00:00.000Z');

    const unpublishResponse = await request(app)
      .post('/api/v1/admin/blog/posts/7301/unpublish')
      .set('Authorization', 'Bearer admin-token')
      .send({});

    expect(unpublishResponse.status).to.equal(200);
    expect(unpublishResponse.body.data.status).to.equal('draft');
    expect(calls.unpublishBlogPost).to.deep.equal({
      adminId: 9001,
      postId: 7301
    });

    const deleteResponse = await request(app)
      .delete('/api/v1/admin/blog/posts/7301')
      .set('Authorization', 'Bearer admin-token');

    expect(deleteResponse.status).to.equal(200);
    expect(deleteResponse.body.data.status).to.equal('archived');
    expect(calls.deleteBlogPost).to.deep.equal({
      adminId: 9001,
      postId: 7301
    });
  });

  it('lists and moderates blog comments through the admin routes', async () => {
    const { app, calls } = buildTestApp();

    const listResponse = await request(app)
      .get('/api/v1/admin/blog/comments')
      .set('Authorization', 'Bearer admin-token')
      .query({
        postId: 7301,
        status: 'pending',
        search: 'fuel',
        page: 1,
        limit: 10
      });

    expect(listResponse.status).to.equal(200);
    expect(listResponse.body.data.comments[0].authorEmail).to.equal('bose.akin@example.com');
    expect(calls.listBlogComments.query).to.deep.equal({
      postId: 7301,
      status: 'pending',
      search: 'fuel',
      page: 1,
      limit: 10,
      offset: 0
    });

    const updateResponse = await request(app)
      .patch('/api/v1/admin/blog/comments/7401')
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'approved'
      });

    expect(updateResponse.status).to.equal(200);
    expect(updateResponse.body.data.status).to.equal('approved');
    expect(updateResponse.body.data.approvedAt).to.equal('2026-08-20T10:00:00.000Z');
    expect(calls.updateBlogComment).to.deep.equal({
      adminId: 9001,
      commentId: 7401,
      status: 'approved'
    });
  });

  it('lists newsletter subscribers and exports them as csv through the admin routes', async () => {
    const { app, calls } = buildTestApp();

    const listResponse = await request(app)
      .get('/api/v1/admin/newsletter/subscribers')
      .set('Authorization', 'Bearer admin-token')
      .query({
        status: 'all',
        search: 'reader',
        page: 1,
        limit: 25
      });

    expect(listResponse.status).to.equal(200);
    expect(listResponse.body.data.subscribers).to.have.length(2);
    expect(calls.listNewsletterSubscribers.query).to.deep.equal({
      status: 'all',
      search: 'reader',
      page: 1,
      limit: 25,
      offset: 0
    });

    const exportResponse = await request(app)
      .get('/api/v1/admin/newsletter/subscribers/export')
      .set('Authorization', 'Bearer admin-token')
      .query({
        status: 'unsubscribed',
        search: 'former-reader'
      });

    expect(exportResponse.status).to.equal(200);
    expect(exportResponse.headers['content-type']).to.contain('text/csv');
    expect(exportResponse.headers['content-disposition']).to.equal(
      'attachment; filename="newsletter-subscribers-2026-08-21.csv"'
    );
    expect(exportResponse.text).to.contain('Email,Status,Subscribed At,Unsubscribed At,Created At');
    expect(exportResponse.text).to.contain('former-reader@example.com');
    expect(calls.exportNewsletterSubscribersCsv).to.deep.equal({
      adminId: 9001,
      query: {
        status: 'unsubscribed',
        search: 'former-reader'
      }
    });
  });

  it('returns 401 when an admin token is missing', async () => {
    const { app } = buildTestApp();

    const response = await request(app)
      .get('/api/v1/admin/blog/categories');

    expect(response.status).to.equal(401);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('AUTH_REQUIRED');
  });

  it('returns 403 when the admin lacks the required blog permission', async () => {
    const { app } = buildTestApp({
      permissions: [ADMIN_PERMISSION_KEYS.READ_SELF]
    });

    const response = await request(app)
      .get('/api/v1/admin/blog/posts')
      .set('Authorization', 'Bearer admin-token');

    expect(response.status).to.equal(403);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 422 for invalid admin blog payloads', async () => {
    const { app } = buildTestApp();

    const invalidPostResponse = await request(app)
      .post('/api/v1/admin/blog/posts')
      .set('Authorization', 'Bearer admin-token')
      .send({
        categoryId: 7101,
        title: 'Bad',
        body: 'Too short',
        authorDisplayName: 'A'
      });

    expect(invalidPostResponse.status).to.equal(422);
    expect(invalidPostResponse.body.success).to.equal(false);
    expect(invalidPostResponse.body.error.code).to.equal('VALIDATION_ERROR');

    const invalidCommentResponse = await request(app)
      .patch('/api/v1/admin/blog/comments/7401')
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'hidden'
      });

    expect(invalidCommentResponse.status).to.equal(422);
    expect(invalidCommentResponse.body.success).to.equal(false);
    expect(invalidCommentResponse.body.error.code).to.equal('VALIDATION_ERROR');
  });
});
