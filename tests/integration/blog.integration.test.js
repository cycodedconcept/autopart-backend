require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const AppError = require('../../src/utils/app-error');

const { expect } = chai;

describe('Blog API integration', () => {
  let app;
  let blogService;
  let commentSubmissionCount;
  let featuredListingCount;
  let viewCount;

  beforeEach(() => {
    commentSubmissionCount = 0;
    featuredListingCount = 0;
    viewCount = 0;
    blogService = {
      listFeaturedListings: async () => {
        featuredListingCount += 1;

        return {
          products: [
            {
              id: 4001,
              title: 'Front Brake Pad Set',
              category: {
                id: 1001,
                name: 'Brake System',
                slug: 'brake-system'
              },
              partNumber: 'FBP-CAM-07011',
              condition: 'new',
              priceKobo: 3700000,
              stockQty: 8,
              location: 'Lagos',
              seller: {
                id: 101,
                businessName: 'Prime Auto Hub',
                rating: 4.7
              },
              primaryImageUrl: 'https://images.example.com/products/front-brake-pad.jpg'
            }
          ]
        };
      },
      getPublicPostBySlug: async (slug) => {
        if (slug === 'missing-post') {
          throw new AppError('Blog post was not found.', {
            statusCode: 404,
            code: 'NOT_FOUND'
          });
        }

        return {
          id: 8301,
          title: 'How to Know When Brake Pads Need Immediate Replacement',
          slug,
          excerpt: 'A quick workshop checklist for spotting worn brake pads early.',
          body: '<p>Brake pads usually warn drivers long before complete failure.</p>',
          featuredImageUrl: 'https://images.example.com/blog/brake-pads-inspection.jpg',
          featuredImageAlt: 'Mechanic inspecting worn brake pads on a sedan',
          author: {
            displayName: 'Aisha Bello',
            avatarUrl: 'https://images.example.com/authors/aisha-bello.jpg'
          },
          category: {
            id: 8101,
            name: 'Maintenance Guides',
            slug: 'maintenance-guides'
          },
          tags: [
            {
              id: 8201,
              name: 'Brake Care',
              slug: 'brake-care'
            }
          ],
          readTimeMinutes: 3,
          publishedAt: '2026-02-12 09:00:00',
          commentCount: 2,
          viewCount: 184
        };
      },
      listPublicComments: async () => ({
        comments: [
          {
            id: 8401,
            parentId: null,
            authorName: 'Chinedu Okoro',
            body: 'This checklist helped me confirm a worn pad set.',
            createdAt: '2026-02-12 18:30:00',
            replies: [
              {
                id: 8402,
                parentId: 8401,
                authorName: 'AutoParts Team',
                body: 'Glad it helped.',
                createdAt: '2026-02-13 07:45:00',
                replies: []
              }
            ]
          }
        ]
      }),
      listPopularTags: async () => ([
        {
          id: 8201,
          name: 'Brake Care',
          slug: 'brake-care',
          postCount: 2
        }
      ]),
      listPublicCategories: async () => ([
        {
          id: 8101,
          name: 'Maintenance Guides',
          slug: 'maintenance-guides',
          description: 'Maintenance content',
          postCount: 4
        }
      ]),
      listPublicPosts: async () => ({
        posts: [
          {
            id: 8306,
            title: 'What a Weak Fuel Pump Sounds Like Before the Car Refuses to Start',
            slug: 'what-a-weak-fuel-pump-sounds-like-before-the-car-refuses-to-start',
            excerpt: 'Hard starts and whining from the tank can point to a failing fuel pump.',
            featuredImageUrl: 'https://images.example.com/blog/fuel-pump-warning-signs.jpg',
            featuredImageAlt: 'Fuel pressure gauge connected during diagnostics',
            author: {
              displayName: 'Kunle Adebayo',
              avatarUrl: 'https://images.example.com/authors/kunle-adebayo.jpg'
            },
            category: {
              id: 8102,
              name: 'Diagnostics',
              slug: 'diagnostics'
            },
            readTimeMinutes: 3,
            publishedAt: '2026-04-16 12:20:00'
          }
        ],
        pagination: {
          page: 1,
          limit: 9,
          total: 1,
          totalPages: 1
        }
      }),
      listRelatedPublicPosts: async () => ([
        {
          id: 8310,
          title: 'Why Shock Absorbers Should Be Replaced in Pairs',
          slug: 'why-shock-absorbers-should-be-replaced-in-pairs',
          excerpt: 'Replacing only one worn shock can leave the vehicle unstable.',
          featuredImageUrl: 'https://images.example.com/blog/replace-shocks-in-pairs.jpg',
          featuredImageAlt: 'Pair of new rear shock absorbers on a bench',
          author: {
            displayName: 'Aisha Bello',
            avatarUrl: 'https://images.example.com/authors/aisha-bello.jpg'
          },
          category: {
            id: 8101,
            name: 'Maintenance Guides',
            slug: 'maintenance-guides'
          },
          readTimeMinutes: 3,
          publishedAt: '2026-06-26 07:40:00'
        }
      ]),
      recordPostView: async () => {
        viewCount += 1;
      },
      submitPublicComment: async () => {
        commentSubmissionCount += 1;

        return {
          data: {
            status: 'pending'
          },
          message: 'Comment submitted successfully and is awaiting moderation.'
        };
      }
    };

    app = createApp({
      blogService
    });
  });

  it('lists public blog posts without requiring authentication', async () => {
    const response = await request(app)
      .get('/api/v1/blog/posts')
      .query({
        category: 'diagnostics',
        tag: 'fuel-system',
        search: 'fuel pump',
        page: 1,
        per_page: 9
      });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.posts).to.have.length(1);
    expect(response.body.data.posts[0]).to.not.have.property('body');
    expect(response.body.data.pagination).to.deep.equal({
      page: 1,
      limit: 9,
      total: 1,
      totalPages: 1
    });
  });

  it('returns blog sidebar featured listings through the public route', async () => {
    const response = await request(app)
      .get('/api/v1/blog/featured-listings');

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.products).to.have.length(1);
    expect(response.body.data.products[0]).to.include({
      id: 4001,
      title: 'Front Brake Pad Set',
      partNumber: 'FBP-CAM-07011'
    });
    expect(featuredListingCount).to.equal(1);
  });

  it('returns 422 when per_page exceeds the maximum', async () => {
    const response = await request(app)
      .get('/api/v1/blog/posts')
      .query({
        per_page: 60
      });

    expect(response.status).to.equal(422);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('VALIDATION_ERROR');
  });

  it('returns the full public blog post detail payload', async () => {
    const response = await request(app)
      .get('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement');

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.slug).to.equal('how-to-know-when-brake-pads-need-immediate-replacement');
    expect(response.body.data.commentCount).to.equal(2);
    expect(response.body.data.tags[0].slug).to.equal('brake-care');
  });

  it('returns 404 for a post that is not publicly visible', async () => {
    const response = await request(app)
      .get('/api/v1/blog/posts/missing-post');

    expect(response.status).to.equal(404);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('NOT_FOUND');
  });

  it('returns related posts, categories, and popular tags through the public routes', async () => {
    const [relatedResponse, categoriesResponse, tagsResponse] = await Promise.all([
      request(app).get('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/related'),
      request(app).get('/api/v1/blog/categories'),
      request(app).get('/api/v1/blog/tags/popular')
    ]);

    expect(relatedResponse.status).to.equal(200);
    expect(relatedResponse.body.data.posts).to.have.length(1);
    expect(categoriesResponse.status).to.equal(200);
    expect(categoriesResponse.body.data.categories[0].postCount).to.equal(4);
    expect(tagsResponse.status).to.equal(200);
    expect(tagsResponse.body.data.tags[0].slug).to.equal('brake-care');
  });

  it('returns approved comments through the public comment route', async () => {
    const response = await request(app)
      .get('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/comments');

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.comments).to.have.length(1);
    expect(response.body.data.comments[0].replies).to.have.length(1);
  });

  it('accepts a public comment submission and returns a moderation response', async () => {
    const response = await request(app)
      .post('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/comments')
      .send({
        authorName: 'Bose Akin',
        authorEmail: 'bose.akin@example.com',
        body: 'Very clear explanation. Thank you.'
      });

    expect(response.status).to.equal(201);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.status).to.equal('pending');
  });

  it('rate limits repeated public comment submissions per post and IP address', async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/comments')
        .set('X-Forwarded-For', '41.76.122.18')
        .send({
          authorName: 'Bose Akin',
          authorEmail: `bose${index}@example.com`,
          body: 'Very clear explanation. Thank you.'
        });

      expect(response.status).to.equal(201);
    }

    const limitedResponse = await request(app)
      .post('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/comments')
      .set('X-Forwarded-For', '41.76.122.18')
      .send({
        authorName: 'Bose Akin',
        authorEmail: 'bose.limit@example.com',
        body: 'Very clear explanation. Thank you.'
      });

    expect(limitedResponse.status).to.equal(429);
    expect(limitedResponse.body.success).to.equal(false);
    expect(limitedResponse.body.error.code).to.equal('RATE_LIMIT_EXCEEDED');
    expect(commentSubmissionCount).to.equal(5);
  });

  it('records a public blog post view with a 204 response', async () => {
    const response = await request(app)
      .post('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/view');

    expect(response.status).to.equal(204);
  });

  it('swallows repeated view pings from the same IP for the same post', async () => {
    const firstResponse = await request(app)
      .post('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/view')
      .set('X-Forwarded-For', '41.76.122.18');
    const secondResponse = await request(app)
      .post('/api/v1/blog/posts/how-to-know-when-brake-pads-need-immediate-replacement/view')
      .set('X-Forwarded-For', '41.76.122.18');

    expect(firstResponse.status).to.equal(204);
    expect(secondResponse.status).to.equal(204);
    expect(viewCount).to.equal(1);
  });
});
