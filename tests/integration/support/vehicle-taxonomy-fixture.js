function createVehicleTaxonomyFixture() {
  return [
    {
      id: 3001,
      make: 'Toyota',
      model: 'Camry',
      yearFrom: 2007,
      yearTo: 2011
    },
    {
      id: 3002,
      make: 'Toyota',
      model: 'Corolla',
      yearFrom: 2010,
      yearTo: 2016
    },
    {
      id: 3003,
      make: 'Toyota',
      model: 'Corolla',
      yearFrom: 2014,
      yearTo: 2019
    },
    {
      id: 3004,
      make: 'Toyota',
      model: 'Camry',
      yearFrom: 2008,
      yearTo: 2012
    },
    {
      id: 3005,
      make: 'Honda',
      model: 'Accord',
      yearFrom: 2008,
      yearTo: 2012
    },
    {
      id: 3006,
      make: 'Lexus',
      model: 'RX 330',
      yearFrom: 2004,
      yearTo: 2006
    },
    {
      id: 3007,
      make: 'Toyota',
      model: 'Hilux',
      yearFrom: 2012,
      yearTo: 2015
    },
    {
      id: 3008,
      make: 'Toyota',
      model: 'Highlander',
      yearFrom: 2003,
      yearTo: 2007
    }
  ];
}

module.exports = {
  createVehicleTaxonomyFixture
};
