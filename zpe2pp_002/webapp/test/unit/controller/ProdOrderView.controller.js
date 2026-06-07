/*global QUnit*/

sap.ui.define([
	"zpe2/pp002/zpe2pp002/controller/ProdOrderView.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ProdOrderView Controller");

	QUnit.test("I should test the ProdOrderView controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
