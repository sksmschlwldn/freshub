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
                summary: {
                    total: 0,
                    completed: 0,
                    processing: 0,
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

            const oBinding = this.byId("actualCostTable").getBinding("rows");

            if (oBinding) {
                oBinding.filter(aFilters);
            }
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

        onActualCostDataUpdated() {
            const oTable = this.byId("actualCostTable");
            const oBinding = oTable?.getBinding("rows");

            if (!oBinding) {
                return;
            }

            const iLength = Math.max(oBinding.getLength(), 0);
            const aContexts = oBinding.getContexts(0, iLength);
            const oSummary = aContexts.reduce((oResult, oContext) => {
                const sStat = oContext.getProperty("Stat");

                oResult.total += 1;

                if (sStat === "Y") {
                    oResult.completed += 1;
                } else if (sStat === "N" || !sStat) {
                    oResult.pending += 1;
                } else {
                    oResult.processing += 1;
                }

                return oResult;
            }, {
                total: 0,
                completed: 0,
                processing: 0,
                pending: 0
            });

            this.getView().getModel("view").setProperty("/summary", oSummary);
        },

        formatCostStatusText(sStat) {
            if (sStat === "Y") {
                return "산정완료";
            }

            if (sStat === "N" || !sStat) {
                return "산정전";
            }

            return "산정중";
        },

        formatCostStatusState(sStat) {
            if (sStat === "Y") {
                return "Success";
            }

            if (sStat === "N" || !sStat) {
                return "Error";
            }

            return "Warning";
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

        formatUnitCost(vAmount, sCurrency, sUnit) {
            if (vAmount === null || vAmount === undefined || vAmount === "") {
                return "-";
            }

            const sAmount = this.formatCurrencyAmount(vAmount, sCurrency);

            return sUnit ? `${sAmount}/${sUnit}` : sAmount;
        },

        _createSearchFilters() {
            const sYear = this.byId("yearComboBox").getSelectedKey();
            const sMonth = this.byId("monthComboBox").getSelectedKey();
            const sMaterial = this.byId("materialInput").getValue().trim();
            const sStat = this.byId("statusComboBox").getSelectedKey();
            const aFilters = [];

            if (!sYear || !sMonth) {
                MessageToast.show("연도와 월은 필수입니다.");
                return null;
            }

            aFilters.push(new Filter("Bdatj", FilterOperator.EQ, sYear));
            aFilters.push(new Filter("Poper", FilterOperator.EQ, sMonth));

            if (sMaterial) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Matnr", FilterOperator.Contains, sMaterial),
                        new Filter("Maktx", FilterOperator.Contains, sMaterial)
                    ],
                    and: false
                }));
            }

            if (sStat) {
                aFilters.push(new Filter("Stat", FilterOperator.EQ, sStat));
            }

            return aFilters;
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
        }
    });
});
