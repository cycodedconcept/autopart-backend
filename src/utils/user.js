function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

module.exports = {
  sanitizeUser
};
