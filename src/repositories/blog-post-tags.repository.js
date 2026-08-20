const { toNumber } = require('./blog-shared.repository');

function mapBlogPostTagRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    postId: toNumber(row.post_id),
    tagId: toNumber(row.tag_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tag: row.tag_id
      ? {
        id: toNumber(row.tag_id),
        name: row.tag_name || null,
        slug: row.tag_slug || null,
        status: row.tag_status || null
      }
      : null
  };
}

function createBlogPostTagsRepository({ db }) {
  return {
    async createPostTag(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO blog_post_tags (
            post_id,
            tag_id
          )
          VALUES (?, ?)
        `,
        [payload.postId, payload.tagId]
      );

      return this.findById(result.insertId);
    },

    async findById(postTagId) {
      const [rows] = await db.execute(
        `
          SELECT
            bpt.id,
            bpt.post_id,
            bpt.tag_id,
            bpt.created_at,
            bpt.updated_at,
            bt.name AS tag_name,
            bt.slug AS tag_slug,
            bt.status AS tag_status
          FROM blog_post_tags bpt
          INNER JOIN blog_tags bt ON bt.id = bpt.tag_id
          WHERE bpt.id = ?
          LIMIT 1
        `,
        [postTagId]
      );

      return mapBlogPostTagRow(rows[0]);
    },

    async listTagsForPost(postId) {
      const [rows] = await db.execute(
        `
          SELECT
            bpt.id,
            bpt.post_id,
            bpt.tag_id,
            bpt.created_at,
            bpt.updated_at,
            bt.name AS tag_name,
            bt.slug AS tag_slug,
            bt.status AS tag_status
          FROM blog_post_tags bpt
          INNER JOIN blog_tags bt ON bt.id = bpt.tag_id
          WHERE bpt.post_id = ?
          ORDER BY bt.name ASC, bt.id ASC
        `,
        [postId]
      );

      return rows.map(mapBlogPostTagRow);
    },

    async listTagIdsForPost(postId) {
      const [rows] = await db.execute(
        `
          SELECT tag_id
          FROM blog_post_tags
          WHERE post_id = ?
          ORDER BY tag_id ASC
        `,
        [postId]
      );

      return rows.map((row) => toNumber(row.tag_id));
    },

    async replaceTagsForPost(postId, tagIds = []) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        await connection.execute(
          `
            DELETE FROM blog_post_tags
            WHERE post_id = ?
          `,
          [postId]
        );

        for (const tagId of tagIds) {
          await connection.execute(
            `
              INSERT INTO blog_post_tags (
                post_id,
                tag_id
              )
              VALUES (?, ?)
            `,
            [postId, tagId]
          );
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      return this.listTagsForPost(postId);
    },

    async removeTagsForPost(postId) {
      await db.execute(
        `
          DELETE FROM blog_post_tags
          WHERE post_id = ?
        `,
        [postId]
      );
    }
  };
}

module.exports = {
  createBlogPostTagsRepository
};
