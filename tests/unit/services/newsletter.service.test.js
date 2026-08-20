require('../../setup/jest');

const { createNewsletterService } = require('../../../src/services/newsletter.service');

describe('newsletter service', () => {
  let newsletterService;
  let newsletterSubscribersRepository;

  beforeEach(() => {
    newsletterSubscribersRepository = {
      findByUnsubscribeToken: jest.fn(),
      unsubscribeByToken: jest.fn(),
      upsertSubscriber: jest.fn()
    };

    newsletterService = createNewsletterService({
      newsletterSubscribersRepository
    });
  });

  it('upserts a normalized newsletter subscription', async () => {
    const result = await newsletterService.subscribe({
      email: ' Fleet-Updates@Example.com ',
      ipAddress: '102.89.12.40'
    });

    expect(newsletterSubscribersRepository.upsertSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'fleet-updates@example.com',
        status: 'subscribed',
        ipAddress: '102.89.12.40',
        unsubscribedAt: null
      })
    );
    expect(newsletterSubscribersRepository.upsertSubscriber.mock.calls[0][0].unsubscribeToken)
      .toHaveLength(64);
    expect(result).toEqual({
      data: {
        status: 'subscribed'
      },
      message: 'Newsletter subscription saved successfully.'
    });
  });

  it('throws a not-found error for an unknown unsubscribe token', async () => {
    newsletterSubscribersRepository.findByUnsubscribeToken.mockResolvedValue(null);

    await expect(newsletterService.unsubscribe('a'.repeat(64))).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  });

  it('unsubscribes an active subscriber', async () => {
    newsletterSubscribersRepository.findByUnsubscribeToken.mockResolvedValue({
      id: 8501,
      status: 'subscribed'
    });
    newsletterSubscribersRepository.unsubscribeByToken.mockResolvedValue({
      id: 8501,
      status: 'unsubscribed',
      unsubscribedAt: '2026-08-20 11:00:00'
    });

    const result = await newsletterService.unsubscribe('b'.repeat(64));

    expect(newsletterSubscribersRepository.unsubscribeByToken).toHaveBeenCalledWith(
      'b'.repeat(64),
      expect.any(Date)
    );
    expect(result).toEqual({
      data: {
        status: 'unsubscribed',
        unsubscribedAt: '2026-08-20 11:00:00'
      },
      message: 'Newsletter subscription updated successfully.'
    });
  });

  it('returns the current state when a subscriber is already unsubscribed', async () => {
    newsletterSubscribersRepository.findByUnsubscribeToken.mockResolvedValue({
      id: 8503,
      status: 'unsubscribed',
      unsubscribedAt: '2026-08-08 12:00:00'
    });

    const result = await newsletterService.unsubscribe('c'.repeat(64));

    expect(newsletterSubscribersRepository.unsubscribeByToken).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: {
        status: 'unsubscribed',
        unsubscribedAt: '2026-08-08 12:00:00'
      },
      message: 'Newsletter subscription updated successfully.'
    });
  });
});
