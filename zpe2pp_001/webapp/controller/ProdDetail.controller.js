sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History"
], (Controller, History) => {
    "use strict";

    return Controller.extend("zpe2.pp001.zpe2pp001.controller.ProdDetail", {
        onInit() {
            this.getOwnerComponent().getRouter()
                .getRoute("RouteProdDetail")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        onNavBack() {
            const sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
                return;
            }

            this.getOwnerComponent().getRouter().navTo("RouteProdView", {}, true);
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

        formatProdQuantity(vGamng, sMeins) {
            if (!vGamng && !sMeins) {
                return "";
            }

            return `${vGamng || ""} ${sMeins || ""}`.trim();
        },

        formatPlanDateRange(sGstrp, sGltrp) {
            if (sGstrp && sGltrp) {
                return `${sGstrp} ~ ${sGltrp}`;
            }

            return sGstrp || sGltrp || "";
        },

        _onRouteMatched(oEvent) {
            const sAufnr = decodeURIComponent(oEvent.getParameter("arguments").aufnr);
            const oModel = this.getOwnerComponent().getModel();
            const sPath = "/" + oModel.createKey("ProdOrderSet", {
                Aufnr: sAufnr
            });

            this.getView().bindElement({
                path: sPath
            });
        }
    });
});
