module.exports = {
  testEnvironment: 'node',
  forceExit: true,
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^whoiser$': '<rootDir>/tests/mocks/whoiserMock.js'
  }
};
