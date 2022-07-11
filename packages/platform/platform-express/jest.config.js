// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  ...require("@tsed/jest-config")(__dirname, "platform-express"),
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 79.31,
      functions: 100,
      lines: 100
    }
  }
};
