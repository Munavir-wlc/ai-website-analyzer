module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,
  openHandlesTimeout: 10000,
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^whoiser$': '<rootDir>/tests/mocks/whoiserMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
