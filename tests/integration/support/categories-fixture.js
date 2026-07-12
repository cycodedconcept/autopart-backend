function createCategoriesFixture() {
  return [
    {
      id: 1001,
      name: 'Engine Components',
      slug: 'engine-components',
      parentId: null,
      status: 'active'
    },
    {
      id: 1002,
      name: 'Brake System',
      slug: 'brake-system',
      parentId: null,
      status: 'active'
    },
    {
      id: 1003,
      name: 'Suspension & Steering',
      slug: 'suspension-steering',
      parentId: null,
      status: 'active'
    },
    {
      id: 1004,
      name: 'Electrical & Lighting',
      slug: 'electrical-lighting',
      parentId: null,
      status: 'active'
    },
    {
      id: 1005,
      name: 'Filters',
      slug: 'filters',
      parentId: 1001,
      status: 'active'
    }
  ];
}

module.exports = {
  createCategoriesFixture
};
