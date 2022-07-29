// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  ...require("@tsed/jest-config")(__dirname, "common"),
  coverageThreshold: {
    global: {
      statements: 97.29,
      branches: 82.58,
      functions: 96.1,
      lines: 97.57
    }
  }
};
