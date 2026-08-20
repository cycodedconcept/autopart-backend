const crypto = require('crypto');
const {
  ERROR_CODES,
  NEWSLETTER_SUBSCRIBER_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');

function generateUnsubscribeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

function createNewsletterService({ newsletterSubscribersRepository }) {
  function buildUnsubscribeResponse(unsubscribedAt) {
    return {
      data: {
        status: NEWSLETTER_SUBSCRIBER_STATUSES.UNSUBSCRIBED,
        unsubscribedAt
      },
      message: 'Newsletter subscription updated successfully.'
    };
  }

  return {
    async subscribe(payload) {
      const subscribedAt = new Date();

      await newsletterSubscribersRepository.upsertSubscriber({
        email: normalizeEmail(payload.email),
        unsubscribeToken: generateUnsubscribeToken(),
        status: NEWSLETTER_SUBSCRIBER_STATUSES.SUBSCRIBED,
        ipAddress: payload.ipAddress || null,
        subscribedAt,
        unsubscribedAt: null
      });

      return {
        data: {
          status: NEWSLETTER_SUBSCRIBER_STATUSES.SUBSCRIBED
        },
        message: 'Newsletter subscription saved successfully.'
      };
    },

    async unsubscribe(unsubscribeToken) {
      const subscriber = await newsletterSubscribersRepository.findByUnsubscribeToken(unsubscribeToken);

      if (!subscriber) {
        throw new AppError('Newsletter subscription was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (subscriber.status === NEWSLETTER_SUBSCRIBER_STATUSES.UNSUBSCRIBED) {
        return buildUnsubscribeResponse(subscriber.unsubscribedAt);
      }

      const updatedSubscriber = await newsletterSubscribersRepository.unsubscribeByToken(
        unsubscribeToken,
        new Date()
      );

      return buildUnsubscribeResponse(updatedSubscriber.unsubscribedAt);
    }
  };
}

module.exports = {
  createNewsletterService
};
