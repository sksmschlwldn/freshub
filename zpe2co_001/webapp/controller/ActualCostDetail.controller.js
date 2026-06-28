/* global Promise */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (
    Controller,
    MessageToast,
    Filter,
    FilterOperator,
    JSONModel
) => {
    "use strict";

    return Controller.extend("zpe2.co001.zpe2co001.controller.ActualCostDetail", {
        onInit() {
            this.getView().setModel(new JSONModel({
                selection: {},
                summary: this._createEmptySummary(),
                prodOrders: [],
                materials: []
            }), "detail");

            this.getOwnerComponent().getRouter()
                .getRoute("RouteActualCostDetail")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        onNavBack() {
            this.getOwnerComponent().getRouter().navTo("RouteActualCostView", {}, true);
        },

        onRefresh() {
            const oSelection = this.getView().getModel("detail").getProperty("/selection");

            if (oSelection?.Matnr && oSelection?.Bdatj && oSelection?.Poper) {
                this._readDetailData(oSelection);
            }
        },

        _onRouteMatched(oEvent) {
            const oArgs = oEvent.getParameter("arguments");
            const oSelectionFromList = this.getOwnerComponent().getModel("actualCostSelection")?.getData() || {};
            const oSelection = {
                ...oSelectionFromList,
                Matnr: decodeURIComponent(oArgs.matnr || ""),
                Bdatj: decodeURIComponent(oArgs.bdatj || ""),
                Poper: decodeURIComponent(oArgs.poper || "")
            };

            this.getView().getModel("detail").setProperty("/selection", oSelection);
            this._readDetailData(oSelection);
        },

        _readDetailData(oSelection) {
            const oView = this.getView();
            const oModel = oView.getModel();
            const aFilters = this._createDetailFilters(oSelection);

            oView.setBusy(true);

            Promise.all([
                this._readEntitySet(oModel, "/ActProdOrderSet", aFilters),
                this._readEntitySet(oModel, "/ActMatSet", aFilters)
            ]).then(([aProdOrders, aMaterials]) => {
                const oSummary = this._createSummary(aProdOrders);

                oView.getModel("detail").setProperty("/prodOrders", aProdOrders);
                oView.getModel("detail").setProperty("/materials", aMaterials);
                oView.getModel("detail").setProperty("/summary", oSummary);
                oView.setBusy(false);
            }).catch(() => {
                oView.getModel("detail").setProperty("/prodOrders", []);
                oView.getModel("detail").setProperty("/materials", []);
                oView.getModel("detail").setProperty("/summary", this._createEmptySummary());
                oView.setBusy(false);
                MessageToast.show("실제원가 상세 조회에 실패했습니다.");
            });
        },

        _readEntitySet(oModel, sPath, aFilters) {
            return new Promise((resolve, reject) => {
                oModel.read(sPath, {
                    filters: aFilters,
                    success: (oData) => resolve(oData.results || []),
                    error: reject
                });
            });
        },

        _createDetailFilters(oSelection) {
            return [
                new Filter("Matnr", FilterOperator.EQ, oSelection.Matnr),
                new Filter("Bdatj", FilterOperator.EQ, oSelection.Bdatj),
                new Filter("Poper", FilterOperator.EQ, oSelection.Poper)
            ];
        },

        _createSummary(aProdOrders) {
            const oSummary = aProdOrders.reduce((oResult, oItem) => {
                oResult.Gamng += this._toNumber(oItem.Gamng);
                oResult.OkQty += this._toNumber(oItem.OkQty);
                oResult.Dmatl += this._toNumber(oItem.Dmatl);
                oResult.Dlabr += this._toNumber(oItem.Dlabr);
                oResult.Mohad += this._toNumber(oItem.Mohad);
                oResult.Wkg00 += this._toNumber(oItem.Wkg00);
                oResult.Waers = oResult.Waers || oItem.Waers;
                oResult.Meins = oResult.Meins || oItem.Meins;

                return oResult;
            }, this._createEmptySummary());

            oSummary.Stprs = oSummary.OkQty ? oSummary.Wkg00 / oSummary.OkQty : 0;

            return oSummary;
        },

        _createEmptySummary() {
            return {
                Gamng: 0,
                OkQty: 0,
                Dmatl: 0,
                Dlabr: 0,
                Mohad: 0,
                Wkg00: 0,
                Stprs: 0,
                Waers: "",
                Meins: ""
            };
        },

        formatHeaderTitle(oSelection) {
            if (!oSelection?.Matnr) {
                return "";
            }

            const sPeriod = this.formatPeriod(oSelection.Bdatj, oSelection.Poper);
            const aTitleParts = [oSelection.Matnr];

            if (oSelection.Maktx) {
                aTitleParts.push(oSelection.Maktx);
            }

            if (sPeriod) {
                aTitleParts.push(sPeriod);
            }

            return aTitleParts.join(" / ");
        },

        formatPeriod(sYear, sMonth) {
            if (!sYear || !sMonth) {
                return "";
            }

            return `${sYear}-${String(sMonth).slice(-2)}`;
        },

        formatDate(vDate) {
            if (!vDate) {
                return "-";
            }

            if (vDate instanceof Date) {
                return this._formatDateObject(vDate);
            }

            const sDate = String(vDate);
            const aMatch = /\/Date\((\d+)\)\//.exec(sDate);

            if (aMatch) {
                return this._formatDateObject(new Date(Number(aMatch[1])));
            }

            if (/^\d{8}$/.test(sDate)) {
                return `${sDate.slice(0, 4)}.${sDate.slice(4, 6)}.${sDate.slice(6, 8)}`;
            }

            return sDate;
        },

        formatQuantity(vQuantity, sUnit) {
            if (vQuantity === null || vQuantity === undefined || vQuantity === "") {
                return "-";
            }

            const sQuantity = this._formatNumber(vQuantity);

            return sUnit ? `${sQuantity} ${sUnit}` : sQuantity;
        },

        formatCurrencyAmount(vAmount, sCurrency) {
            if (vAmount === null || vAmount === undefined || vAmount === "") {
                return "-";
            }

            const sAmount = this._formatNumber(vAmount);
            const sCurrencyText = this._formatCurrencyText(sCurrency);

            return sCurrencyText ? `${sAmount} ${sCurrencyText}` : sAmount;
        },

        formatUnitCost(vAmount, sCurrency, sUnit) {
            const sAmount = this.formatCurrencyAmount(vAmount, sCurrency);

            if (sAmount === "-") {
                return "-";
            }

            return sUnit ? `${sAmount}/${sUnit}` : sAmount;
        },

        _formatDateObject(oDate) {
            const sYear = String(oDate.getFullYear());
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sDay = String(oDate.getDate()).padStart(2, "0");

            return `${sYear}.${sMonth}.${sDay}`;
        },

        _formatNumber(vValue) {
            const fValue = this._toNumber(vValue);

            if (!Number.isFinite(fValue)) {
                return String(vValue);
            }

            return fValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 3
            });
        },

        _formatCurrencyText(sCurrency) {
            if (sCurrency === "KRW") {
                return "원";
            }

            return sCurrency || "";
        },

        _toNumber(vValue) {
            const fValue = Number(String(vValue ?? 0).replace(/,/g, ""));

            return Number.isFinite(fValue) ? fValue : 0;
        }
    });
});
