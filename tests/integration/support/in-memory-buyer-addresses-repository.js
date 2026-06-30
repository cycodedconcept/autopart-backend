function createInMemoryBuyerAddressesRepository({ store }) {
  function cloneAddress(address) {
    return address ? { ...address } : null;
  }

  return {
    async createBuyerAddress(payload) {
      const now = new Date().toISOString();
      const address = {
        id: store.counters.addressId,
        userId: payload.userId,
        label: payload.label,
        street: payload.street,
        city: payload.city,
        state: payload.state,
        phone: payload.phone,
        isDefault: Boolean(payload.isDefault),
        createdAt: now,
        updatedAt: now
      };

      store.addresses.push(address);
      store.counters.addressId += 1;

      return cloneAddress(address);
    },

    async findBuyerAddressByIdForUser(userId, addressId) {
      return cloneAddress(
        store.addresses.find((address) => address.userId === userId && address.id === Number(addressId))
        || null
      );
    }
  };
}

module.exports = {
  createInMemoryBuyerAddressesRepository
};
