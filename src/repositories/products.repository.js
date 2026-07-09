function mapCategoryRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapVehicleTaxonomyRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    make: row.make,
    model: row.model,
    yearFrom: Number(row.year_from),
    yearTo: Number(row.year_to),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

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
    stockQty: Number(row.stock_qty),
    location: row.location,
    sellerBusinessName: row.seller_business_name,
    sellerRating: row.seller_rating === null || row.seller_rating === undefined
      ? null
      : Number(row.seller_rating),
    status: row.status,
    primaryImageUrl: row.primary_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSellerListingTrendRow(row) {
  return {
    currentPeriodListings: Number((row && row.current_period_listings) || 0),
    previousPeriodListings: Number((row && row.previous_period_listings) || 0)
  };
}

function buildPublicProductFilterQuery(filters) {
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
    whereClauses.push('sp.rating >= ?');
    params.push(filters.sellerRating);
  }

  if (filters.sellerBusinessName) {
    whereClauses.push('LOWER(sp.business_name) LIKE ?');
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

function buildSellerProductFilterQuery(filters) {
  const whereClauses = ['p.seller_id = ?'];
  const params = [filters.sellerId];

  if (filters.status && filters.status !== 'all') {
    whereClauses.push('p.status = ?');
    params.push(filters.status);
  }

  if (filters.lowStockOnly) {
    whereClauses.push('p.stock_qty <= ?');
    params.push(filters.lowStockThreshold);
  }

  return {
    whereSql: whereClauses.join(' AND '),
    params
  };
}

function buildSelectProductColumns() {
  return `
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
    sp.business_name AS seller_business_name,
    sp.rating AS seller_rating,
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
  `;
}

async function insertCompatibilityWithConnection(connection, productId, compatibility = []) {
  for (const entry of compatibility) {
    await connection.execute(
      `
        INSERT INTO product_compatibility (
          product_id,
          make,
          model,
          year_from,
          year_to
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        productId,
        entry.make,
        entry.model,
        entry.yearFrom,
        entry.yearTo
      ]
    );
  }
}

async function insertImagesWithConnection(connection, productId, photos = []) {
  for (const photo of photos) {
    await connection.execute(
      `
        INSERT INTO product_images (
          product_id,
          url,
          position
        )
        VALUES (?, ?, ?)
      `,
      [productId, photo.filePath, photo.position]
    );
  }
}

function createProductsRepository({ db }) {
  const selectProductColumns = buildSelectProductColumns();

  return {
    async createSellerProductsBulk(payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();
        const productIds = [];

        for (const product of payload.products) {
          const [result] = await connection.execute(
            `
              INSERT INTO products (
                seller_id,
                title,
                description,
                category_id,
                part_number,
                \`condition\`,
                price_kobo,
                stock_qty,
                location,
                status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              payload.sellerId,
              product.title,
              product.description,
              product.categoryId,
              product.partNumber,
              product.condition,
              product.priceKobo,
              product.stockQty,
              product.location,
              product.status
            ]
          );

          await insertImagesWithConnection(connection, result.insertId, product.photos);
          await insertCompatibilityWithConnection(connection, result.insertId, product.compatibility);
          productIds.push(result.insertId);
        }

        await connection.commit();

        const products = await Promise.all(
          productIds.map((productId) => this.findOwnedProductById(productId, payload.sellerId))
        );

        return products;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async createSellerProduct(payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          `
            INSERT INTO products (
              seller_id,
              title,
              description,
              category_id,
              part_number,
              \`condition\`,
              price_kobo,
              stock_qty,
              location,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            payload.sellerId,
            payload.title,
            payload.description,
            payload.categoryId,
            payload.partNumber,
            payload.condition,
            payload.priceKobo,
            payload.stockQty,
            payload.location,
            payload.status
          ]
        );

        await insertImagesWithConnection(connection, result.insertId, payload.photos);
        await insertCompatibilityWithConnection(connection, result.insertId, payload.compatibility);
        await connection.commit();

        return this.findOwnedProductById(result.insertId, payload.sellerId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async deactivateOwnedProduct(productId, sellerId) {
      await db.execute(
        `
          UPDATE products
          SET status = 'inactive'
          WHERE id = ? AND seller_id = ?
        `,
        [productId, sellerId]
      );

      return this.findOwnedProductById(productId, sellerId);
    },

    async findCategoryById(categoryId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            parent_id,
            created_at,
            updated_at
          FROM categories
          WHERE id = ?
          LIMIT 1
        `,
        [categoryId]
      );

      return mapCategoryRow(rows[0]);
    },

    async findCategoriesByIds(categoryIds) {
      if (!categoryIds.length) {
        return [];
      }

      const placeholders = categoryIds.map(() => '?').join(', ');
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            parent_id,
            created_at,
            updated_at
          FROM categories
          WHERE id IN (${placeholders})
          ORDER BY id ASC
        `,
        categoryIds
      );

      return rows.map(mapCategoryRow);
    },

    async findCategoryBySlug(slug) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            parent_id,
            created_at,
            updated_at
          FROM categories
          WHERE slug = ?
          LIMIT 1
        `,
        [slug]
      );

      return mapCategoryRow(rows[0]);
    },

    async listAllCategories() {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            parent_id,
            created_at,
            updated_at
          FROM categories
          ORDER BY parent_id ASC, name ASC, id ASC
        `
      );

      return rows.map(mapCategoryRow);
    },

    async createCategory(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO categories (name, slug, parent_id)
          VALUES (?, ?, ?)
        `,
        [payload.name, payload.slug, payload.parentId]
      );

      return this.findCategoryById(result.insertId);
    },

    async updateCategory(categoryId, payload) {
      const fields = [];
      const params = [];

      if (payload.name !== undefined) {
        fields.push('name = ?');
        params.push(payload.name);
      }

      if (payload.slug !== undefined) {
        fields.push('slug = ?');
        params.push(payload.slug);
      }

      if (payload.parentId !== undefined) {
        fields.push('parent_id = ?');
        params.push(payload.parentId);
      }

      if (!fields.length) {
        return this.findCategoryById(categoryId);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');

      await db.execute(
        `
          UPDATE categories
          SET ${fields.join(', ')}
          WHERE id = ?
        `,
        [...params, categoryId]
      );

      return this.findCategoryById(categoryId);
    },

    async deleteCategory(categoryId) {
      const category = await this.findCategoryById(categoryId);

      if (!category) {
        return null;
      }

      await db.execute(
        `
          DELETE FROM categories
          WHERE id = ?
        `,
        [categoryId]
      );

      return category;
    },

    async countChildCategories(categoryId) {
      const [rows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM categories
          WHERE parent_id = ?
        `,
        [categoryId]
      );

      return Number(rows[0].total || 0);
    },

    async countProductsByCategoryId(categoryId) {
      const [rows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM products
          WHERE category_id = ?
        `,
        [categoryId]
      );

      return Number(rows[0].total || 0);
    },

    async findVehicleTaxonomyById(vehicleTaxonomyId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            make,
            model,
            year_from,
            year_to,
            created_at,
            updated_at
          FROM vehicles_taxonomy
          WHERE id = ?
          LIMIT 1
        `,
        [vehicleTaxonomyId]
      );

      return mapVehicleTaxonomyRow(rows[0]);
    },

    async findVehicleTaxonomyEntry(payload) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            make,
            model,
            year_from,
            year_to,
            created_at,
            updated_at
          FROM vehicles_taxonomy
          WHERE make = ? AND model = ? AND year_from = ? AND year_to = ?
          LIMIT 1
        `,
        [payload.make, payload.model, payload.yearFrom, payload.yearTo]
      );

      return mapVehicleTaxonomyRow(rows[0]);
    },

    async listVehicleTaxonomy(filters) {
      const whereClauses = [];
      const params = [];

      if (filters.make) {
        whereClauses.push('LOWER(make) = ?');
        params.push(filters.make.trim().toLowerCase());
      }

      if (filters.model) {
        whereClauses.push('LOWER(model) = ?');
        params.push(filters.model.trim().toLowerCase());
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM vehicles_taxonomy
          ${whereSql}
        `,
        params
      );
      const [rows] = await db.execute(
        `
          SELECT
            id,
            make,
            model,
            year_from,
            year_to,
            created_at,
            updated_at
          FROM vehicles_taxonomy
          ${whereSql}
          ORDER BY make ASC, model ASC, year_from ASC, year_to ASC, id ASC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        entries: rows.map(mapVehicleTaxonomyRow),
        total: Number(countRows[0].total || 0)
      };
    },

    async createVehicleTaxonomy(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO vehicles_taxonomy (make, model, year_from, year_to)
          VALUES (?, ?, ?, ?)
        `,
        [payload.make, payload.model, payload.yearFrom, payload.yearTo]
      );

      return this.findVehicleTaxonomyById(result.insertId);
    },

    async updateVehicleTaxonomy(vehicleTaxonomyId, payload) {
      const fields = [];
      const params = [];

      if (payload.make !== undefined) {
        fields.push('make = ?');
        params.push(payload.make);
      }

      if (payload.model !== undefined) {
        fields.push('model = ?');
        params.push(payload.model);
      }

      if (payload.yearFrom !== undefined) {
        fields.push('year_from = ?');
        params.push(payload.yearFrom);
      }

      if (payload.yearTo !== undefined) {
        fields.push('year_to = ?');
        params.push(payload.yearTo);
      }

      if (!fields.length) {
        return this.findVehicleTaxonomyById(vehicleTaxonomyId);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');

      await db.execute(
        `
          UPDATE vehicles_taxonomy
          SET ${fields.join(', ')}
          WHERE id = ?
        `,
        [...params, vehicleTaxonomyId]
      );

      return this.findVehicleTaxonomyById(vehicleTaxonomyId);
    },

    async deleteVehicleTaxonomy(vehicleTaxonomyId) {
      const entry = await this.findVehicleTaxonomyById(vehicleTaxonomyId);

      if (!entry) {
        return null;
      }

      await db.execute(
        `
          DELETE FROM vehicles_taxonomy
          WHERE id = ?
        `,
        [vehicleTaxonomyId]
      );

      return entry;
    },

    async countProductCompatibilityReferences(payload) {
      const [rows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM product_compatibility
          WHERE make = ? AND model = ? AND year_from = ? AND year_to = ?
        `,
        [payload.make, payload.model, payload.yearFrom, payload.yearTo]
      );

      return Number(rows[0].total || 0);
    },

    async findOwnedProductById(productId, sellerId) {
      const [rows] = await db.execute(
        `
          SELECT
            ${selectProductColumns}
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          WHERE p.id = ? AND p.seller_id = ?
          LIMIT 1
        `,
        [productId, sellerId]
      );

      return mapProductRow(rows[0]);
    },

    async findProductById(productId) {
      const [rows] = await db.execute(
        `
          SELECT
            ${selectProductColumns}
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
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
      const { whereSql, params } = buildPublicProductFilterQuery(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          WHERE ${whereSql}
        `,
        params
      );
      const [rows] = await db.execute(
        `
          SELECT
            ${selectProductColumns}
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          WHERE ${whereSql}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        products: rows.map(mapProductRow),
        total: Number(countRows[0].total)
      };
    },

    async listSellerProducts(filters) {
      const { whereSql, params } = buildSellerProductFilterQuery(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM products p
          WHERE ${whereSql}
        `,
        params
      );
      const [rows] = await db.execute(
        `
          SELECT
            ${selectProductColumns}
          FROM products p
          INNER JOIN categories c ON c.id = p.category_id
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          WHERE ${whereSql}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        products: rows.map(mapProductRow),
        total: Number(countRows[0].total)
      };
    },

    async summarizeSellerInventory(filters) {
      const [rows] = await db.execute(
        `
          SELECT
            COUNT(*) AS total_listings,
            SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS active_listings,
            SUM(CASE WHEN p.status = 'inactive' THEN 1 ELSE 0 END) AS inactive_listings,
            SUM(CASE WHEN p.stock_qty = 0 THEN 1 ELSE 0 END) AS out_of_stock_listings,
            SUM(
              CASE
                WHEN p.stock_qty > 0 AND p.stock_qty <= ? THEN 1
                ELSE 0
              END
            ) AS low_stock_listings,
            COALESCE(SUM(p.stock_qty), 0) AS total_units_in_stock
          FROM products p
          WHERE p.seller_id = ?
        `,
        [filters.lowStockThreshold, filters.sellerId]
      );

      return {
        totalListings: Number(rows[0].total_listings || 0),
        activeListings: Number(rows[0].active_listings || 0),
        inactiveListings: Number(rows[0].inactive_listings || 0),
        outOfStockListings: Number(rows[0].out_of_stock_listings || 0),
        lowStockListings: Number(rows[0].low_stock_listings || 0),
        totalUnitsInStock: Number(rows[0].total_units_in_stock || 0)
      };
    },

    async summarizeSellerListingTrend(filters) {
      const [rows] = await db.execute(
        `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN p.created_at >= ? AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY) THEN 1
                  ELSE 0
                END
              ),
              0
            ) AS current_period_listings,
            COALESCE(
              SUM(
                CASE
                  WHEN p.created_at >= ? AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY) THEN 1
                  ELSE 0
                END
              ),
              0
            ) AS previous_period_listings
          FROM products p
          WHERE p.seller_id = ?
        `,
        [
          filters.currentDateFrom,
          filters.currentDateTo,
          filters.previousDateFrom,
          filters.previousDateTo,
          filters.sellerId
        ]
      );

      return mapSellerListingTrendRow(rows[0]);
    },

    async updateOwnedProduct(productId, sellerId, payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        if (payload.fields && payload.fields.length) {
          const updateSql = payload.fields.map((field) => `${field.column} = ?`).join(', ');
          const updateParams = payload.fields.map((field) => field.value);

          await connection.execute(
            `
              UPDATE products
              SET ${updateSql}
              WHERE id = ? AND seller_id = ?
            `,
            [...updateParams, productId, sellerId]
          );
        }

        if (payload.photos) {
          await connection.execute(
            'DELETE FROM product_images WHERE product_id = ?',
            [productId]
          );
          await insertImagesWithConnection(connection, productId, payload.photos);
        }

        if (payload.compatibility) {
          await connection.execute(
            'DELETE FROM product_compatibility WHERE product_id = ?',
            [productId]
          );
          await insertCompatibilityWithConnection(connection, productId, payload.compatibility);
        }

        await connection.commit();

        return this.findOwnedProductById(productId, sellerId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = {
  createProductsRepository
};
