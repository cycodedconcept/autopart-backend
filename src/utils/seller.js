function sanitizeSellerDocument(document) {
  if (!document) {
    return null;
  }

  return {
    id: document.id,
    type: document.type,
    filePath: document.filePath,
    uploadedAt: document.uploadedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

function sanitizeSellerProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    userId: profile.userId,
    businessName: profile.businessName,
    rating: profile.rating,
    contactPhone: profile.contactPhone,
    contactEmail: profile.contactEmail,
    address: profile.address,
    cacNumber: profile.cacNumber,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason,
    documents: (profile.documents || []).map(sanitizeSellerDocument),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function sanitizeSellerAccount(account, sanitizeUser) {
  if (!account) {
    return null;
  }

  return {
    user: sanitizeUser(account.user),
    sellerProfile: sanitizeSellerProfile(account.sellerProfile)
  };
}

module.exports = {
  sanitizeSellerAccount,
  sanitizeSellerDocument,
  sanitizeSellerProfile
};
