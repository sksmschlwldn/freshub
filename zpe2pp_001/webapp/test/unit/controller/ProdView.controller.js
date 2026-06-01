/*global QUnit*/

sap.ui.define([
	"zpe2/pp001/zpe2pp001/controller/ProdView.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ProdView Controller");

	QUnit.test("I should test the ProdView controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
