sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
  ],
  (Controller, MessageToast, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("zpe2.pp002.zpe2pp002.controller.ProdOrderView", {
      onInit() {
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
        const aFilters = [];
        const sAufnr = this.byId("aufnrInput").getValue().trim();
        const sPlnbez = this.byId("plnbezInput").getValue().trim();
        const sGstrpFrom = this._normalizeSearchDate(
          this.byId("gstrpFromDate").getValue(),
        );
        const sGstrpTo = this._normalizeSearchDate(
          this.byId("gstrpToDate").getValue(),
        );
        const aStatKeys = this.byId("statMultiComboBox").getSelectedKeys();

        if (sAufnr) {
          aFilters.push(new Filter("Aufnr", FilterOperator.Contains, sAufnr));
        }

        if (sPlnbez) {
          aFilters.push(new Filter("Plnbez", FilterOperator.Contains, sPlnbez));
        }

        if (sGstrpFrom && sGstrpTo) {
          aFilters.push(
            new Filter("Gstrp", FilterOperator.BT, sGstrpFrom, sGstrpTo),
          );
        } else if (sGstrpFrom) {
          aFilters.push(new Filter("Gstrp", FilterOperator.GE, sGstrpFrom));
        } else if (sGstrpTo) {
          aFilters.push(new Filter("Gstrp", FilterOperator.LE, sGstrpTo));
        }

        if (aStatKeys.length) {
          aFilters.push(
            new Filter({
              filters: aStatKeys.map(
                (sKey) =>
                  new Filter(
                    "Stat",
                    FilterOperator.EQ,
                    sKey === "0" ? "" : sKey,
                  ),
              ),
              and: false,
            }),
          );
        }

        this.byId("prodOrderTable").getBinding("rows").filter(aFilters);
      },

      onResetSearch() {
        this.byId("aufnrInput").setValue("");
        this.byId("plnbezInput").setValue("");
        this.byId("gstrpFromDate").setValue("");
        this.byId("gstrpToDate").setValue("");
        this._setDefaultSearchValues();
        this.onSearch();
      },

      onValueHelpRequest() {
        MessageToast.show("검색 도움말 준비 중입니다.");
      },

      onPressProdInstruction(oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sAufnr = oContext?.getProperty("Aufnr");
        const oModel = this.getView().getModel();

        if (!sAufnr) {
          MessageToast.show("생산오더번호가 없습니다.");
          return;
        }

        oModel.update(
          this._createProdOrderKeyPath(sAufnr),
          this._createProdOrderPayload(oContext.getObject()),
          {
            success: () => {
              oModel.refresh();
              MessageToast.show(`${sAufnr}가 생산지시되었습니다.`);
            },
            error: () => {
              MessageToast.show("생산지시 실패");
            },
          },
        );
      },

      onPressProdDetail(oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sAufnr = oContext?.getProperty("Aufnr");

        if (!sAufnr) {
          MessageToast.show("생산오더번호가 없습니다.");
          return;
        }

        this.getOwnerComponent()
          .getRouter()
          .navTo("RouteProdOrderDetail", {
            aufnr: encodeURIComponent(sAufnr),
          });
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

      formatProdInstructionVisible(sStat) {
        return !sStat;
      },

      _setDefaultSearchValues() {
        const oToday = new Date();

        this.byId("gstrpFromDate").setDateValue(oToday);
        this.byId("gstrpToDate").setValue("");
        this.byId("statMultiComboBox").setSelectedKeys(["1", "0", "2"]);
      },

      _createProdOrderPayload(oOrder) {
        return {
          Aufnr: oOrder.Aufnr || "",
          Plnbez: oOrder.Plnbez || "",
          Charg: oOrder.Charg || "",
          Stlnr: oOrder.Stlnr || "",
          Plnnr: oOrder.Plnnr || "",
          Stat: oOrder.Stat || "",
          Gamng: this._formatDecimal(oOrder.Gamng),
          Meins: oOrder.Meins || "",
          Apstat: oOrder.Apstat || "",
          Gstrp: oOrder.Gstrp || "",
          Gltrp: oOrder.Gltrp || "",
          Ordat: oOrder.Ordat || "",
          Aenam: oOrder.Aenam || "",
          Aedat: oOrder.Aedat || "",
          Aezet: oOrder.Aezet || "",
          Maktx: oOrder.Maktx || "",
        };
      },

      _createProdOrderKeyPath(sAufnr) {
        return (
          "/" +
          this.getView().getModel().createKey("ProdOrderSet", {
            Aufnr: sAufnr,
          })
        );
      },

      _formatDecimal(vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
          return "0";
        }

        const fValue = Number(String(vValue).replace(/,/g, ""));

        return Number.isFinite(fValue) ? String(fValue) : "0";
      },

      _normalizeSearchDate(sDate) {
        if (!sDate) {
          return "";
        }

        const sValue = String(sDate).trim();

        if (/^\d{8}$/.test(sValue)) {
          return sValue;
        }

        return sValue.replace(/[.-]/g, "");
      },
    });
  },
);
