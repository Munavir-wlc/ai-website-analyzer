module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,
  forceExit: true,
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^whoiser$': '<rootDir>/tests/mocks/whoiserMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
