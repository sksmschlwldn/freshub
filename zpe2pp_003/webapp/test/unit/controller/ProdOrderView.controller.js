/*global QUnit*/

sap.ui.define([
	"zpe2/pp003/zpe2pp003/controller/ProdOrderView.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ProdOrderView Controller");

	QUnit.test("I should test the ProdOrderView controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
