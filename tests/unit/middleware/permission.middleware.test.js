require('../../setup/jest');

const { authorizePermissions } = require('../../../src/middleware/permission.middleware');

describe('permission middleware', () => {
  it('calls next when the admin has the required permission', () => {
    const next = jest.fn();
    const middleware = authorizePermissions('sellers.verify');

    middleware({
      admin: {
        permissions: ['admins.read_self', 'sellers.verify']
      }
    }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when the admin lacks the required permission', () => {
    const next = jest.fn();
    const middleware = authorizePermissions('sellers.verify');

    middleware({
      admin: {
        permissions: ['admins.read_self']
      }
    }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      code: 'FORBIDDEN'
    }));
  });

  it('returns 401 when no admin is attached to the request', () => {
    const next = jest.fn();
    const middleware = authorizePermissions('sellers.verify');

    middleware({}, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED'
    }));
  });
});
