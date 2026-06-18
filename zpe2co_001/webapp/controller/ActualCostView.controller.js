sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, Filter, FilterOperator, JSONModel) => {
    "use strict";

    return Controller.extend("zpe2.co001.zpe2co001.controller.ActualCostView", {
        onInit() {
            this.getView().setModel(new JSONModel({
                year: "",
                month: "",
                items: [],
                summary: {
                    total: 0,
                    completed: 0,
                    pending: 0
                }
            }), "view");

            this._setDefaultSearchValues();
        },

        onAfterRendering() {
            if (this._bInitialSearchDone) {
                return;
            }

            this._bInitialSearchDone = true;
            this.onSearch();
        },

        onSearch() {
            const aFilters = this._createSearchFilters();

            if (!aFilters) {
                return;
            }

            const oTable = this.byId("actualCostTable");

            oTable.setBusy(true);

            this.getView().getModel().read("/ActualCostSet", {
                filters: aFilters,
                success: (oData) => {
                    const aItems = this._applyClientStatusFilter(oData.results || []);

                    this.getView().getModel("view").setProperty("/items", aItems);
                    this._updateSummary(aItems);
                    oTable.setBusy(false);
                },
                error: () => {
                    this.getView().getModel("view").setProperty("/items", []);
                    this._updateSummary([]);
                    oTable.setBusy(false);
                    MessageToast.show("실제원가 조회에 실패했습니다.");
                }
            });
        },

        onResetSearch() {
            this.byId("materialInput").setValue("");
            this.byId("statusComboBox").setSelectedKey("");
            this._setDefaultSearchValues();
            this.onSearch();
        },

        onValueHelpRequest() {
            MessageToast.show("검색 도움말 준비 중입니다.");
        },

        onPressCalculate(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("view");
            const sMatnr = oContext?.getProperty("Matnr");

            MessageToast.show(sMatnr ? `${sMatnr} 산정 준비 중입니다.` : "산정 준비 중입니다.");
        },

        onPressDetail(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("view");
            const sMatnr = oContext?.getProperty("Matnr");

            MessageToast.show(sMatnr ? `${sMatnr} 상세 준비 중입니다.` : "상세 준비 중입니다.");
        },

        _updateSummary(aItems) {
            const oSummary = aItems.reduce((oResult, oItem) => {
                const sStat = oItem.Stat;

                oResult.total += 1;

                if (sStat === "Y") {
                    oResult.completed += 1;
                } else {
                    oResult.pending += 1;
                }

                return oResult;
            }, {
                total: 0,
                completed: 0,
                pending: 0
            });

            this.getView().getModel("view").setProperty("/summary", oSummary);
        },

        formatCostStatusText(sStat) {
            if (sStat === "Y") {
                return "⏺ 산정완료";
            }

            return "⏺ 산정전";
        },

        formatCostStatusState(sStat) {
            if (sStat === "Y") {
                return "Success";
            }

            return "Error";
        },

        formatCalculateButtonVisible(sStat) {
            return this._isPendingStatus(sStat);
        },

        formatCurrencyAmount(vAmount, sCurrency) {
            if (vAmount === null || vAmount === undefined || vAmount === "") {
                return "-";
            }

            const sAmount = this._formatNumber(vAmount);
            const sCurrencyText = this._formatCurrencyText(sCurrency);

            return sCurrencyText ? `${sAmount} ${sCurrencyText}` : sAmount;
        },

        formatCurrencyAmountFallback(vPrimaryAmount, vFallbackAmount, sCurrency) {
            const vAmount = vPrimaryAmount || vFallbackAmount;

            return this.formatCurrencyAmount(vAmount, sCurrency);
        },

        formatActualQuantity(vQuantity, sUnit, sStat) {
            if (this._isPendingStatus(sStat)) {
                return "-";
            }

            if (vQuantity === null || vQuantity === undefined || vQuantity === "") {
                return "-";
            }

            const sQuantity = this._formatNumber(vQuantity);

            return sUnit ? `${sQuantity} ${sUnit}` : sQuantity;
        },

        formatActualCurrencyAmount(vAmount, sCurrency, sStat) {
            if (this._isPendingStatus(sStat)) {
                return "-";
            }

            return this.formatCurrencyAmount(vAmount, sCurrency);
        },

        formatActualCurrencyAmountFallback(vPrimaryAmount, vFallbackAmount, sCurrency, sStat) {
            if (this._isPendingStatus(sStat)) {
                return "-";
            }

            return this.formatCurrencyAmountFallback(vPrimaryAmount, vFallbackAmount, sCurrency);
        },

        formatUnitCost(vAmount, sCurrency, sUnit) {
            if (vAmount === null || vAmount === undefined || vAmount === "") {
                return "-";
            }

            const sAmount = this.formatCurrencyAmount(vAmount, sCurrency);

            return sUnit ? `${sAmount}/${sUnit}` : sAmount;
        },

        formatActualUnitCost(vAmount, sCurrency, sUnit, sStat) {
            if (this._isPendingStatus(sStat)) {
                return "-";
            }

            return this.formatUnitCost(vAmount, sCurrency, sUnit);
        },

        _createSearchFilters() {
            const sYear = this.byId("yearComboBox").getSelectedKey();
            const sMonth = this.byId("monthComboBox").getSelectedKey();
            const sMaterial = this.byId("materialInput").getValue().trim();
            const aFilters = [];

            if (!sYear || !sMonth) {
                MessageToast.show("연도와 월은 필수입니다.");
                return null;
            }

            aFilters.push(new Filter("Bdatj", FilterOperator.EQ, sYear));
            aFilters.push(new Filter("Poper", FilterOperator.EQ, sMonth));

            if (sMaterial) {
                aFilters.push(new Filter("Matnr", FilterOperator.Contains, sMaterial));
            }

            return aFilters;
        },

        _applyClientStatusFilter(aItems) {
            const sStat = this.byId("statusComboBox").getSelectedKey();

            if (sStat === "Y") {
                return aItems.filter((oItem) => oItem.Stat === "Y");
            }

            if (sStat === "N") {
                return aItems.filter((oItem) => this._isPendingStatus(oItem.Stat));
            }

            return aItems;
        },

        _setDefaultSearchValues() {
            const oToday = new Date();
            const sYear = String(oToday.getFullYear());
            const sMonth = String(oToday.getMonth() + 1).padStart(3, "0");
            const oViewModel = this.getView().getModel("view");

            oViewModel.setProperty("/year", sYear);
            oViewModel.setProperty("/month", sMonth);
        },

        _formatNumber(vValue) {
            const fValue = Number(String(vValue).replace(/,/g, ""));

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

        _isPendingStatus(sStat) {
            return sStat !== "Y";
        }
    });
});
