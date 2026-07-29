/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    // Use ts-jest for tsx/ts files or babel-jest for jsx/js files
    '^.+\\.tsx?$': 'ts-jest', 
  },
  moduleNameMapper: {
    // Mocks CSS and image imports which Vite handles differently
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
