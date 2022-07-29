// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  ...require("@tsed/jest-config")(__dirname, "platform-koa"),
  coverageThreshold: {
    global: {
      statements: 98.36,
      branches: 88.37,
      functions: 98.11,
      lines: 98.33
    }
  }
};
