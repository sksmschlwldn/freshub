/*global QUnit*/

sap.ui.define([
	"zpe2/co001/zpe2co001/controller/ActualCostView.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ActualCostView Controller");

	QUnit.test("I should test the ActualCostView controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
