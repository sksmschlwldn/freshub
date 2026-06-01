sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], (Controller, MessageToast) => {
    "use strict";

    return Controller.extend("zpe2.pp001.zpe2pp001.controller.ProdView", {
        onInit() {
            this._setDefaultSearchDates();
        },

        onPressProdInstruction(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const sAufnr = oContext?.getProperty("Aufnr");

            MessageToast.show(`생산지시 처리 예정: ${sAufnr}`);
        },

        onPressProdDetail(oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const sAufnr = oContext?.getProperty("Aufnr");

            if (!sAufnr) {
                MessageToast.show("생산오더번호가 없습니다.");
                return;
            }

            this.getOwnerComponent().getRouter().navTo("RouteProdDetail", {
                aufnr: encodeURIComponent(sAufnr)
            });
        },

        onSearch() {
            MessageToast.show("조회 로직 구현 예정");
        },

        onResetSearch() {
            this.byId("aufnrInput").setValue("");
            this.byId("plnbezInput").setValue("");
            this.byId("statSelect").setSelectedKey("ALL");
            this._setDefaultSearchDates();
        },

        formatProdStatusText(sStat) {
            switch (sStat) {
                case "1":
                    return "진행중";
                case "2":
                    return "완료";
                case "3":
                    return "취소";
                default:
                    return "미진행";
            }
        },

        formatProdStatusState(sStat) {
            switch (sStat) {
                case "1":
                    return "Information";
                case "2":
                    return "Success";
                case "3":
                    return "Error";
                default:
                    return "None";
            }
        },

        _setDefaultSearchDates() {
            const oToday = new Date();
            const oNextWeek = new Date(oToday);

            oNextWeek.setDate(oToday.getDate() + 7);

            this.byId("gstrpFromDate").setDateValue(oToday);
            this.byId("gstrpToDate").setDateValue(oNextWeek);
            this.byId("statSelect").setSelectedKey("ALL");
        }
    });
});
