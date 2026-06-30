function mapBuyerAddressRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    street: row.street,
    city: row.city,
    state: row.state,
    phone: row.phone,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createBuyerAddressesRepository({ db }) {
  return {
    async createBuyerAddress(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO buyer_addresses (user_id, label, street, city, state, phone, is_default)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.userId,
          payload.label,
          payload.street,
          payload.city,
          payload.state,
          payload.phone,
          payload.isDefault ? 1 : 0
        ]
      );

      return this.findBuyerAddressByIdForUser(payload.userId, result.insertId);
    },

    async findBuyerAddressByIdForUser(userId, addressId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            user_id,
            label,
            street,
            city,
            state,
            phone,
            is_default,
            created_at,
            updated_at
          FROM buyer_addresses
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `,
        [addressId, userId]
      );

      return mapBuyerAddressRow(rows[0]);
    }
  };
}

module.exports = {
  createBuyerAddressesRepository
};
