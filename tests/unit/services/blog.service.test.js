require('../../setup/jest');

const { createBlogService } = require('../../../src/services/blog.service');

describe('blog service', () => {
  let blogCategoriesRepository;
  let blogCommentsRepository;
  let blogPostTagsRepository;
  let blogPostsRepository;
  let blogService;
  let blogTagsRepository;
  let productsService;

  beforeEach(() => {
    blogCategoriesRepository = {
      listPublicCategoriesWithPostCounts: jest.fn()
    };
    blogCommentsRepository = {
      countComments: jest.fn(),
      createComment: jest.fn(),
      findById: jest.fn(),
      listComments: jest.fn()
    };
    blogPostTagsRepository = {
      listTagsForPost: jest.fn()
    };
    blogPostsRepository = {
      countPublicPosts: jest.fn(),
      findPublicPostBySlug: jest.fn(),
      incrementViewCount: jest.fn(),
      listPublicPosts: jest.fn(),
      listRecentPublicPostsExcluding: jest.fn(),
      listRelatedPublicPosts: jest.fn()
    };
    blogTagsRepository = {
      listPopularTags: jest.fn()
    };
    productsService = {
      listProducts: jest.fn()
    };

    blogService = createBlogService({
      blogCategoriesRepository,
      blogCommentsRepository,
      blogPostTagsRepository,
      blogPostsRepository,
      blogTagsRepository,
      productsService
    });
  });

  describe('listFeaturedListings', () => {
    it('reuses the public products service DTO for blog sidebar featured listings', async () => {
      productsService.listProducts.mockResolvedValue({
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
        ],
        pagination: {
          page: 1,
          limit: 3,
          total: 1,
          totalPages: 1
        }
      });

      const result = await blogService.listFeaturedListings();

      expect(productsService.listProducts).toHaveBeenCalledWith({
        page: 1,
        limit: 3
      });
      expect(result).toEqual({
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
      });
    });
  });

  describe('listPublicPosts', () => {
    it('returns public post summaries with pagination metadata', async () => {
      blogPostsRepository.listPublicPosts.mockResolvedValue([
        {
          id: 8306,
          title: 'What a Weak Fuel Pump Sounds Like Before the Car Refuses to Start',
          slug: 'what-a-weak-fuel-pump-sounds-like-before-the-car-refuses-to-start',
          excerpt: 'Hard starts and whining from the tank can point to a failing fuel pump.',
          body: '<p>Full article body</p>',
          featuredImageUrl: 'https://images.example.com/blog/fuel-pump-warning-signs.jpg',
          featuredImageAlt: 'Fuel pressure gauge connected during diagnostics',
          authorDisplayName: 'Kunle Adebayo',
          authorAvatarUrl: 'https://images.example.com/authors/kunle-adebayo.jpg',
          category: {
            id: 8102,
            name: 'Diagnostics',
            slug: 'diagnostics',
            status: 'active'
          },
          readTimeMinutes: 3,
          publishedAt: '2026-04-16 12:20:00',
          status: 'published'
        }
      ]);
      blogPostsRepository.countPublicPosts.mockResolvedValue(1);

      const result = await blogService.listPublicPosts({
        category: 'diagnostics',
        tag: 'fuel-system',
        search: 'fuel pump',
        sort: 'latest',
        page: 2,
        per_page: 4
      });

      expect(blogPostsRepository.listPublicPosts).toHaveBeenCalledWith({
        categorySlug: 'diagnostics',
        tagSlug: 'fuel-system',
        search: 'fuel pump',
        sort: 'latest',
        page: 2,
        limit: 4,
        offset: 4
      });
      expect(blogPostsRepository.countPublicPosts).toHaveBeenCalledWith({
        categorySlug: 'diagnostics',
        tagSlug: 'fuel-system',
        search: 'fuel pump',
        sort: 'latest',
        page: 2,
        limit: 4,
        offset: 4
      });
      expect(result).toEqual({
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
          page: 2,
          limit: 4,
          total: 1,
          totalPages: 1
        }
      });
    });
  });

  describe('getPublicPostBySlug', () => {
    it('returns a full public post detail payload with approved comment count', async () => {
      blogPostsRepository.findPublicPostBySlug.mockResolvedValue({
        id: 8301,
        categoryId: 8101,
        title: 'How to Know When Brake Pads Need Immediate Replacement',
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
        excerpt: 'A quick workshop checklist for spotting worn brake pads early.',
        body: '<p>Brake pads usually warn drivers long before complete failure.</p>',
        featuredImageUrl: 'https://images.example.com/blog/brake-pads-inspection.jpg',
        featuredImageAlt: 'Mechanic inspecting worn brake pads on a sedan',
        authorDisplayName: 'Aisha Bello',
        authorAvatarUrl: 'https://images.example.com/authors/aisha-bello.jpg',
        category: {
          id: 8101,
          name: 'Maintenance Guides',
          slug: 'maintenance-guides',
          status: 'active'
        },
        readTimeMinutes: 3,
        publishedAt: '2026-02-12 09:00:00',
        viewCount: 184
      });
      blogPostTagsRepository.listTagsForPost.mockResolvedValue([
        {
          id: 1,
          tag: {
            id: 8201,
            name: 'Brake Care',
            slug: 'brake-care'
          }
        }
      ]);
      blogCommentsRepository.countComments.mockResolvedValue(2);

      const result = await blogService.getPublicPostBySlug(
        'how-to-know-when-brake-pads-need-immediate-replacement'
      );

      expect(blogCommentsRepository.countComments).toHaveBeenCalledWith({
        postId: 8301,
        status: 'approved'
      });
      expect(result).toEqual({
        id: 8301,
        title: 'How to Know When Brake Pads Need Immediate Replacement',
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
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
      });
    });

    it('throws a not-found error when the post is not publicly visible', async () => {
      blogPostsRepository.findPublicPostBySlug.mockResolvedValue(null);

      await expect(blogService.getPublicPostBySlug('future-post')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    });
  });

  describe('listRelatedPublicPosts', () => {
    it('backfills related posts with recent public posts when the category set is short', async () => {
      blogPostsRepository.findPublicPostBySlug.mockResolvedValue({
        id: 8305,
        categoryId: 8101,
        title: 'Cabin and Engine Filters',
        slug: 'cabin-and-engine-filters',
        authorDisplayName: 'Aisha Bello',
        authorAvatarUrl: 'https://images.example.com/authors/aisha-bello.jpg',
        category: {
          id: 8101,
          name: 'Maintenance Guides',
          slug: 'maintenance-guides'
        },
        excerpt: 'Filter service intervals that make sense in dusty cities.',
        featuredImageUrl: 'https://images.example.com/blog/filter-service-lagos.jpg',
        featuredImageAlt: 'Replacement filters on a workbench',
        readTimeMinutes: 3,
        publishedAt: '2026-04-02 07:50:00'
      });
      blogPostsRepository.listRelatedPublicPosts.mockResolvedValue([
        {
          id: 8310,
          title: 'Why Shock Absorbers Should Be Replaced in Pairs',
          slug: 'why-shock-absorbers-should-be-replaced-in-pairs',
          excerpt: 'Replacing only one worn shock can leave the vehicle unstable.',
          featuredImageUrl: 'https://images.example.com/blog/replace-shocks-in-pairs.jpg',
          featuredImageAlt: 'Pair of new rear shock absorbers on a bench',
          authorDisplayName: 'Aisha Bello',
          authorAvatarUrl: 'https://images.example.com/authors/aisha-bello.jpg',
          category: {
            id: 8101,
            name: 'Maintenance Guides',
            slug: 'maintenance-guides'
          },
          readTimeMinutes: 3,
          publishedAt: '2026-06-26 07:40:00'
        }
      ]);
      blogPostsRepository.listRecentPublicPostsExcluding.mockResolvedValue([
        {
          id: 8311,
          title: 'Battery, Alternator, or Starter: A Simple No-Start Triage Guide',
          slug: 'battery-alternator-or-starter-a-simple-no-start-triage-guide',
          excerpt: 'A no-start complaint becomes easier to solve with the right triage.',
          featuredImageUrl: 'https://images.example.com/blog/no-start-triage.jpg',
          featuredImageAlt: 'Technician testing battery voltage with a multimeter',
          authorDisplayName: 'Kunle Adebayo',
          authorAvatarUrl: 'https://images.example.com/authors/kunle-adebayo.jpg',
          category: {
            id: 8102,
            name: 'Diagnostics',
            slug: 'diagnostics'
          },
          readTimeMinutes: 3,
          publishedAt: '2026-07-10 11:00:00'
        },
        {
          id: 8312,
          title: 'How to Compare Seller Warranty Terms Before Ordering',
          slug: 'how-to-compare-seller-warranty-terms-before-ordering',
          excerpt: 'Warranty language matters when you are comparing similar part offers.',
          featuredImageUrl: 'https://images.example.com/blog/compare-warranty-terms.jpg',
          featuredImageAlt: 'Buyer reviewing multiple invoices and warranty notes',
          authorDisplayName: 'Mariam Okonkwo',
          authorAvatarUrl: 'https://images.example.com/authors/mariam-okonkwo.jpg',
          category: {
            id: 8103,
            name: 'Buying Tips',
            slug: 'buying-tips'
          },
          readTimeMinutes: 2,
          publishedAt: '2026-07-24 09:15:00'
        }
      ]);

      const result = await blogService.listRelatedPublicPosts('cabin-and-engine-filters');

      expect(blogPostsRepository.listRecentPublicPostsExcluding).toHaveBeenCalledWith({
        excludePostIds: [8305, 8310],
        limit: 2
      });
      expect(result).toHaveLength(3);
      expect(result[0].slug).toBe('why-shock-absorbers-should-be-replaced-in-pairs');
      expect(result[2].slug).toBe('how-to-compare-seller-warranty-terms-before-ordering');
    });
  });

  describe('listPublicCategories', () => {
    it('returns only categories that have visible posts', async () => {
      blogCategoriesRepository.listPublicCategoriesWithPostCounts.mockResolvedValue([
        {
          id: 8101,
          name: 'Maintenance Guides',
          slug: 'maintenance-guides',
          description: 'Maintenance content',
          postCount: 4
        },
        {
          id: 8105,
          name: 'Industry News',
          slug: 'industry-news',
          description: 'News content',
          postCount: 0
        }
      ]);

      const result = await blogService.listPublicCategories();

      expect(result).toEqual([
        {
          id: 8101,
          name: 'Maintenance Guides',
          slug: 'maintenance-guides',
          description: 'Maintenance content',
          postCount: 4
        }
      ]);
    });
  });

  describe('listPopularTags', () => {
    it('returns mapped popular tags', async () => {
      blogTagsRepository.listPopularTags.mockResolvedValue([
        {
          id: 8202,
          name: 'Engine Health',
          slug: 'engine-health',
          postCount: 3
        }
      ]);

      const result = await blogService.listPopularTags();

      expect(blogTagsRepository.listPopularTags).toHaveBeenCalledWith({
        limit: 10
      });
      expect(result).toEqual([
        {
          id: 8202,
          name: 'Engine Health',
          slug: 'engine-health',
          postCount: 3
        }
      ]);
    });
  });

  describe('listPublicComments', () => {
    it('returns approved comments threaded one level deep without private fields', async () => {
      blogPostsRepository.findPublicPostBySlug.mockResolvedValue({
        id: 8301,
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      });
      blogCommentsRepository.listComments.mockResolvedValue([
        {
          id: 8401,
          postId: 8301,
          parentId: null,
          authorName: 'Chinedu Okoro',
          authorEmail: 'chinedu.okoro@example.com',
          body: 'This checklist helped me confirm a worn pad set.',
          ipAddress: '102.89.4.21',
          createdAt: '2026-02-12 18:30:00'
        },
        {
          id: 8402,
          postId: 8301,
          parentId: 8401,
          authorName: 'AutoParts Team',
          authorEmail: 'support@example.com',
          body: 'Glad it helped.',
          ipAddress: '102.89.4.22',
          createdAt: '2026-02-13 07:45:00'
        }
      ]);

      const result = await blogService.listPublicComments(
        'how-to-know-when-brake-pads-need-immediate-replacement'
      );

      expect(blogCommentsRepository.listComments).toHaveBeenCalledWith({
        postId: 8301,
        status: 'approved'
      });
      expect(result).toEqual({
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
      });
    });
  });

  describe('submitPublicComment', () => {
    beforeEach(() => {
      blogPostsRepository.findPublicPostBySlug.mockResolvedValue({
        id: 8301,
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement'
      });
    });

    it('creates a pending public comment with normalized fields', async () => {
      blogCommentsRepository.createComment.mockResolvedValue({
        id: 8410
      });

      const result = await blogService.submitPublicComment({
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
        authorName: '  Bose Akin  ',
        authorEmail: '  Bose.Akin@example.com ',
        body: 'Very clear explanation. I will check rotor wear next.',
        ipAddress: '41.76.122.18'
      });

      expect(blogCommentsRepository.createComment).toHaveBeenCalledWith({
        postId: 8301,
        parentId: null,
        authorName: 'Bose Akin',
        authorEmail: 'bose.akin@example.com',
        body: 'Very clear explanation. I will check rotor wear next.',
        status: 'pending',
        ipAddress: '41.76.122.18'
      });
      expect(result).toEqual({
        data: {
          status: 'pending'
        },
        message: 'Comment submitted successfully and is awaiting moderation.'
      });
    });

    it('silently discards a comment when the honeypot is filled', async () => {
      const result = await blogService.submitPublicComment({
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
        authorName: 'Spam Bot',
        authorEmail: 'spam@example.com',
        body: 'Helpful write-up.',
        website: 'https://spam.invalid'
      });

      expect(blogCommentsRepository.createComment).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: {
          status: 'pending'
        },
        message: 'Comment submitted successfully and is awaiting moderation.'
      });
    });

    it('rejects a link-only comment body', async () => {
      await expect(blogService.submitPublicComment({
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
        authorName: 'Promo Account',
        authorEmail: 'promo@example.com',
        body: 'https://spam.invalid/deal'
      })).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR'
      });

      expect(blogCommentsRepository.createComment).not.toHaveBeenCalled();
    });

    it('rejects replies to replies', async () => {
      blogCommentsRepository.findById.mockResolvedValue({
        id: 8402,
        postId: 8301,
        parentId: 8401,
        status: 'approved'
      });

      await expect(blogService.submitPublicComment({
        slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
        authorName: 'Late Reply',
        authorEmail: 'late.reply@example.com',
        body: 'Adding another nested reply.',
        parentId: 8402
      })).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('recordPostView', () => {
    it('increments the public post view count when the post is visible', async () => {
      blogPostsRepository.findPublicPostBySlug.mockResolvedValue({
        id: 8311,
        slug: 'battery-alternator-or-starter-a-simple-no-start-triage-guide'
      });

      await blogService.recordPostView('battery-alternator-or-starter-a-simple-no-start-triage-guide');

      expect(blogPostsRepository.incrementViewCount).toHaveBeenCalledWith(8311);
    });
  });
});
