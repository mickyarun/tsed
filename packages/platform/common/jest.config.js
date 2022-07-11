// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  ...require("@tsed/jest-config")(__dirname, "common"),
  coverageThreshold: {
    global: {
      statements: 95.59,
      branches: 82.79,
      functions: 92.45,
      lines: 95.73
    }
  }
};
