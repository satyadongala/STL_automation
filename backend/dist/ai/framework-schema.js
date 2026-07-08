"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRAMEWORK_SCHEMA = void 0;
exports.frameworkSchemaText = frameworkSchemaText;
/** Canonical Playwright framework layout (matches framework-scaffold.ts). */
exports.FRAMEWORK_SCHEMA = {
    root: 'playwright-framework',
    folders: {
        tests: 'Feature specs: tests/login/, tests/api/, tests/dashboard/, tests/ui/',
        pages: 'Page objects: BasePage, LoginPage, DashboardPage, HomePage',
        locators: 'Selector maps: loginLocators.ts, dashboardLocators.ts',
        fixtures: 'Playwright fixtures: baseFixture.ts, testData.ts',
        utils: 'logger, helpers, constants, randomData',
        data: 'users.json, config.json, products.json',
        hooks: 'beforeEach.ts, afterEach.ts',
        reports: 'html, allure-results, screenshots',
    },
    assertionTypes: ['status_code', 'json_path', 'response_time', 'header'],
    jsonPathRules: 'No spaces in paths. Example: $.data[0].name not $.data[0]. name',
    uiActions: [
        'click', 'fill', 'select', 'check', 'uncheck', 'wait_for_selector',
        'expect_visible', 'expect_text', 'expect_url', 'extract_text', 'goto', 'screenshot',
    ],
};
function frameworkSchemaText() {
    return JSON.stringify(exports.FRAMEWORK_SCHEMA, null, 2);
}
