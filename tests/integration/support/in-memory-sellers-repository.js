function cloneDocument(document) {
  return document ? { ...document } : null;
}

function cloneSellerProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    rating: profile.rating,
    documents: (profile.documents || []).map(cloneDocument)
  };
}

function cloneSellerAccount(account) {
  if (!account) {
    return null;
  }

  return {
    user: account.user ? { ...account.user } : null,
    sellerProfile: cloneSellerProfile(account.sellerProfile)
  };
}

function createInMemorySellersRepository({ usersRepository }) {
  const sellerProfiles = [];
  const sellerDocuments = [];
  let sellerIdCounter = 1;
  let documentIdCounter = 1;

  function buildSellerAccount(profile) {
    if (!profile) {
      return null;
    }

    const user = usersRepository.findById(profile.userId);

    return Promise.resolve(user).then((resolvedUser) => {
      if (!resolvedUser) {
        return null;
      }

      return cloneSellerAccount({
        user: resolvedUser,
        sellerProfile: {
          ...profile,
          documents: sellerDocuments
            .filter((document) => document.sellerId === profile.id)
            .map(cloneDocument)
        }
      });
    });
  }

  return {
    async createSellerAccount({ user, profile }) {
      const createdUser = await usersRepository.createUser(user);
      const now = new Date().toISOString();
      const sellerProfile = {
        id: sellerIdCounter,
        userId: createdUser.id,
        businessName: profile.businessName,
        contactPhone: profile.contactPhone,
        contactEmail: profile.contactEmail,
        address: profile.address,
        cacNumber: profile.cacNumber,
        rating: profile.rating || 0,
        verificationStatus: profile.verificationStatus,
        rejectionReason: profile.rejectionReason,
        createdAt: now,
        updatedAt: now,
        documents: []
      };

      sellerProfiles.push(sellerProfile);
      sellerIdCounter += 1;

      return cloneSellerAccount({
        user: createdUser,
        sellerProfile
      });
    },

    async findByCacNumber(cacNumber) {
      const profile = sellerProfiles.find((entry) => entry.cacNumber === cacNumber) || null;

      return buildSellerAccount(profile);
    },

    async findBySellerId(sellerId) {
      const profile = sellerProfiles.find((entry) => entry.id === sellerId) || null;

      return buildSellerAccount(profile);
    },

    async findByUserId(userId) {
      const profile = sellerProfiles.find((entry) => entry.userId === userId) || null;

      return buildSellerAccount(profile);
    },

    async findDocumentsBySellerId(sellerId) {
      return sellerDocuments
        .filter((document) => document.sellerId === sellerId)
        .map(cloneDocument);
    },

    async replaceDocuments({ sellerId, documents, verificationStatus, rejectionReason }) {
      const profile = sellerProfiles.find((entry) => entry.id === sellerId);

      if (!profile) {
        return null;
      }

      for (let index = sellerDocuments.length - 1; index >= 0; index -= 1) {
        if (sellerDocuments[index].sellerId === sellerId) {
          sellerDocuments.splice(index, 1);
        }
      }

      const now = new Date().toISOString();

      for (const document of documents) {
        sellerDocuments.push({
          id: documentIdCounter,
          sellerId,
          type: document.type,
          filePath: document.filePath,
          uploadedAt: now,
          createdAt: now,
          updatedAt: now
        });
        documentIdCounter += 1;
      }

      profile.verificationStatus = verificationStatus;
      profile.rejectionReason = rejectionReason;
      profile.updatedAt = now;

      return buildSellerAccount(profile);
    },

    async updateVerificationStatus({ sellerId, status, rejectionReason }) {
      const profile = sellerProfiles.find((entry) => entry.id === sellerId);

      if (!profile) {
        return null;
      }

      profile.verificationStatus = status;
      profile.rejectionReason = rejectionReason;
      profile.updatedAt = new Date().toISOString();

      return buildSellerAccount(profile);
    }
  };
}

module.exports = {
  createInMemorySellersRepository
};
