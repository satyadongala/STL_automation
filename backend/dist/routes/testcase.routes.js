"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const testcase_controller_1 = require("../controllers/testcase.controller");
const router = (0, express_1.Router)();
router.get('/', testcase_controller_1.getTestCases);
router.get('/:id', testcase_controller_1.getTestCaseById);
router.post('/', testcase_controller_1.createTestCase);
router.put('/reorder', testcase_controller_1.reorderTestCases); // Put reorder before :id to prevent mapping collision
router.put('/:id', testcase_controller_1.updateTestCase);
router.delete('/:id', testcase_controller_1.deleteTestCase);
exports.default = router;
