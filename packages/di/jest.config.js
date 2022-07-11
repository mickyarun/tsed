// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  ...require("@tsed/jest-config")(__dirname, "di"),
  coverageThreshold: {
    global: {
      statements: 97.69,
      branches: 91.2,
      functions: 97.22,
      lines: 97.73
    }
  }
};
