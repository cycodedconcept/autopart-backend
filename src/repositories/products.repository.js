function mapCompatibilityRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    productId: row.product_id,
    make: row.make,
    model: row.model,
    yearFrom: row.year_from,
    yearTo: row.year_to
  };
}

function mapImageRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    productId: row.product_id,
    url: row.url,
    position: row.position
  };
}

function mapProductRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sellerId: row.seller_id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    partNumber: row.part_number,
    condition: row.condition,
    priceKobo: Number(row.price_kobo),
    stockQty: row.stock_qty,
    location: row.location,
    sellerBusinessName: row.seller_business_name,
    sellerRating: Number(row.seller_rating),
    status: row.status,
    primaryImageUrl: row.primary_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildProductFilterQuery(filters) {
  const whereClauses = ['p.status = ?'];
  const params = ['active'];

  if (filters.partName) {
    const searchTerm = `%${filters.partName}%`;

    whereClauses.push('(p.title LIKE ? OR p.description LIKE ?)');
    params.push(searchTerm, searchTerm);
  }

  if (filters.partNumber) {
    whereClauses.push('p.part_number LIKE ?');
    params.push(`%${filters.partNumber}%`);
  }

  if (filters.condition) {
    whereClauses.push('p.`condition` = ?');
    params.push(filters.condition);
  }

  if (filters.category !== null && filters.category !== undefined) {
    if (typeof filters.category === 'number') {
      whereClauses.push('c.id = ?');
      params.push(filters.category);
    } else {
      const normalizedCategory = filters.category.trim().toLowerCase();

      whereClauses.push('(LOWER(c.slug) = ? OR LOWER(c.name) = ?)');
      params.push(normalizedCategory, normalizedCategory);
    }
  }

  if (filters.minPriceKobo !== null && filters.minPriceKobo !== undefined) {
    whereClauses.push('p.price_kobo >= ?');
    params.push(filters.minPriceKobo);
  }

  if (filters.maxPriceKobo !== null && filters.maxPriceKobo !== undefined) {
    whereClauses.push('p.price_kobo <= ?');
    params.push(filters.maxPriceKobo);
  }

  if (filters.location) {
    whereClauses.push('LOWER(p.location) LIKE ?');
    params.push(`%${filters.location.trim().toLowerCase()}%`);
  }

  if (filters.sellerRating !== null && filters.sellerRating !== undefined) {
    whereClauses.push('p.seller_rating >= ?');
    params.push(filters.sellerRating);
  }

  if (filters.sellerBusinessName) {
    whereClauses.push('LOWER(p.seller_business_name) LIKE ?');
    params.push(`%${filters.sellerBusinessName.trim().toLowerCase()}%`);
  }

  if (filters.vehicleMake || filters.vehicleModel || filters.vehicleYear) {
    const compatibilityClauses = ['pc.product_id = p.id'];

    if (filters.vehicleMake) {
      compatibilityClauses.push('LOWER(pc.make) = ?');
      params.push(filters.vehicleMake.trim().toLowerCase());
    }

    if (filters.vehicleModel) {
      compatibilityClauses.push('LOWER(pc.model) = ?');
      params.push(filters.vehicleModel.trim().toLowerCase());
    }

    if (filters.vehicleYear !== null && filters.vehicleYear !== undefined) {
      compatibilityClauses.push('pc.year_from <= ?');
      compatibilityClauses.push('pc.year_to >= ?');
      params.push(filters.vehicleYear, filters.vehicleYear);
    }

    whereClauses.push(`
      EXISTS (
        SELECT 1
        FROM product_compatibility pc
        WHERE ${compatibilityClauses.join(' AND ')}
      )
    `);
  }

  return {
    whereSql: whereClauses.join(' AND '),
    params
  };
}

function createProductsRepository({ db }) {
  return {
    async findProductById(productId) {
      const [rows] = await db.execute(
        `
          SELECT
            p.id,
            p.seller_id,
            p.title,
            p.description,
            p.category_id,
            c.name AS category_name,
            c.slug AS category_slug,
            p.part_number,
            p.\`condition\` AS \`condition\`,
            p.price_kobo,
            p.stock_qty,
            p.location,
            p.seller_business_name,
            p.seller_rating,
            p.status,
            (
              SELECT pi.url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC
              LIMIT 1
            ) AS primary_image_url,
            p.created_at,
            p.updated_at
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          WHERE p.id = ? AND p.status = 'active'
          LIMIT 1
        `,
        [productId]
      );

      return mapProductRow(rows[0]);
    },

    async findProductCompatibilityByProductId(productId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            product_id,
            make,
            model,
            year_from,
            year_to
          FROM product_compatibility
          WHERE product_id = ?
          ORDER BY make ASC, model ASC, year_from ASC, year_to ASC
        `,
        [productId]
      );

      return rows.map(mapCompatibilityRow);
    },

    async findProductImagesByProductId(productId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            product_id,
            url,
            position
          FROM product_images
          WHERE product_id = ?
          ORDER BY position ASC, id ASC
        `,
        [productId]
      );

      return rows.map(mapImageRow);
    },

    async listProducts(filters) {
      const { whereSql, params } = buildProductFilterQuery(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          WHERE ${whereSql}
        `,
        params
      );
      const [rows] = await db.execute(
        `
          SELECT
            p.id,
            p.seller_id,
            p.title,
            p.description,
            p.category_id,
            c.name AS category_name,
            c.slug AS category_slug,
            p.part_number,
            p.\`condition\` AS \`condition\`,
            p.price_kobo,
            p.stock_qty,
            p.location,
            p.seller_business_name,
            p.seller_rating,
            p.status,
            (
              SELECT pi.url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC
              LIMIT 1
            ) AS primary_image_url,
            p.created_at,
            p.updated_at
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          WHERE ${whereSql}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        products: rows.map(mapProductRow),
        total: countRows[0].total
      };
    }
  };
}

module.exports = {
  createProductsRepository
};
