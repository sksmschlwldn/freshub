sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
	    "sap/m/MessageToast",
	    "sap/ui/model/Filter",
	    "sap/ui/model/FilterOperator",
	    "sap/ui/model/json/JSONModel",
	    "sap/ui/model/odata/v2/ODataModel",
	    "sap/m/SelectDialog",
	    "sap/m/StandardListItem",
	  ],
	  (
	    Controller,
	    MessageToast,
	    Filter,
	    FilterOperator,
	    JSONModel,
	    ODataModel,
	    SelectDialog,
	    StandardListItem,
	  ) => {
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

	      onValueHelpRequest(oEvent) {
	        const oInput = oEvent.getSource();
	        const sInputId = oInput.getId();

	        if (sInputId.includes("aufnrInput")) {
	          this._openValueHelp({
	            input: oInput,
	            title: "생산오더번호",
	            serviceUrl: "/sap/opu/odata/sap/ZCDS_E2_PP_0010_CDS/",
	            entitySet: "/AufnrSet",
	            keyField: "Aufnr",
	            descriptionField: "Maktx",
	            type: "order",
	          });
	          return;
	        }

	        if (sInputId.includes("plnbezInput")) {
	          this._openValueHelp({
	            input: oInput,
	            title: "자재번호",
	            serviceUrl: "/sap/opu/odata/sap/ZCDS_E2_PP_0009_CDS/",
	            entitySet: "/PlnbezSet",
	            keyField: "Matnr",
	            descriptionField: "Maktx",
	            type: "material",
	          });
	          return;
	        }

	        MessageToast.show("검색 도움말을 찾을 수 없습니다.");
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
            return "⏺ 진행중";
          case "2":
            return "⏺ 완료";
          case "3":
            return "⏺ 취소";
          default:
            return "⏺ 미진행";
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

      _normalizeSearchDate(vDate) {
        if (!vDate) {
          return "";
        }

        if (vDate instanceof Date) {
          return this._formatSearchDate(vDate);
        }

        const sValue = String(vDate).trim();
        const aODataDateMatch = /\/Date\((\d+)\)\//.exec(sValue);

        if (aODataDateMatch) {
          return this._formatSearchDate(new Date(Number(aODataDateMatch[1])));
        }

        if (/^\d{8}$/.test(sValue)) {
          return sValue;
        }

        if (/^\d{4}[.-]\d{2}[.-]\d{2}$/.test(sValue)) {
          return sValue.replace(/[.-]/g, "");
        }

        const oDate = new Date(sValue);

        if (!Number.isNaN(oDate.getTime())) {
          return this._formatSearchDate(oDate);
        }

        return "";
      },

      _formatSearchDate(oDate) {
        const sYear = String(oDate.getFullYear());
        const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
        const sDay = String(oDate.getDate()).padStart(2, "0");

        return `${sYear}${sMonth}${sDay}`;
      },

	      _openValueHelp(oConfig) {
	        const oDialog = this._getValueHelpDialog();
	        const oModel = new ODataModel(oConfig.serviceUrl, {
	          useBatch: false,
	          defaultCountMode: "None",
	        });
	        let bDone = false;
	        let iTimer = null;
	        const fnFinish = () => {
	          bDone = true;
	          clearTimeout(iTimer);
	          oDialog.setBusy(false);
	        };
	        const fnFail = (sMessage) => {
	          if (bDone) {
	            return;
	          }

	          fnFinish();
	          MessageToast.show(sMessage);
	        };

	        oDialog.setTitle(oConfig.title);
	        oDialog.data("input", oConfig.input);
	        oDialog.data("type", oConfig.type);
	        oDialog.setBusy(true);
	        oDialog.setModel(
	          new JSONModel({
	            items: [],
	          }),
	          "valueHelp",
	        );
	        oDialog.open();

	        iTimer = setTimeout(() => {
	          fnFail(`${oConfig.title} 검색 도움말 응답 시간이 초과되었습니다.`);
	        }, 15000);

	        oModel.attachMetadataFailed(() => {
	          fnFail(`${oConfig.title} 메타데이터 조회 실패: ${oConfig.serviceUrl}`);
	        });

	        oModel.attachRequestFailed((oEvent) => {
	          const sMessage = oEvent.getParameter("message") || "요청 실패";

	          fnFail(`${oConfig.title} 검색 도움말 요청 실패: ${sMessage}`);
	        });

	        oModel.read(oConfig.entitySet, {
	          success: (oData) => {
	            if (bDone) {
	              return;
	            }

	            const aItems = (oData.results || [])
	              .map((oRow) => ({
	                key: oRow[oConfig.keyField] || "",
	                description: oRow[oConfig.descriptionField] || "",
	                row: oRow,
	              }))
	              .filter((oItem) => oItem.key);

	            oDialog.getModel("valueHelp").setProperty("/items", aItems);
	            fnFinish();
	          },
	          error: () => {
	            fnFail(`${oConfig.title} 검색 도움말을 불러오지 못했습니다.`);
	          },
	        });
	      },

	      _getValueHelpDialog() {
	        if (!this._oValueHelpDialog) {
	          this._oValueHelpDialog = new SelectDialog({
	            noDataText: "조회된 데이터가 없습니다.",
	            search: (oEvent) => {
	              const sValue = oEvent.getParameter("value");
	              const oBinding = oEvent.getSource().getBinding("items");

	              oBinding.filter(
	                sValue
	                  ? new Filter({
	                      filters: [
	                        new Filter("key", FilterOperator.Contains, sValue),
	                        new Filter("description", FilterOperator.Contains, sValue),
	                      ],
	                      and: false,
	                    })
	                  : [],
	              );
	            },
	            confirm: (oEvent) => {
	              const oSelectedItem = oEvent.getParameter("selectedItem");
	              const oInput = oEvent.getSource().data("input");
	              const sType = oEvent.getSource().data("type");
	              const oSelectedData = oSelectedItem
	                ?.getBindingContext("valueHelp")
	                ?.getObject();

	              if (oSelectedItem && oInput) {
	                oInput.setValue(oSelectedItem.getTitle());
	                this._applyValueHelpSelection(sType, oSelectedData?.row || {});
	                this.onSearch();
	              }
	            },
	            cancel: (oEvent) => {
	              oEvent.getSource().getBinding("items").filter([]);
	            },
	          });

	          this._oValueHelpDialog.bindAggregation("items", {
	            path: "valueHelp>/items",
	            template: new StandardListItem({
	              title: "{valueHelp>key}",
	              description: "{valueHelp>description}",
	              type: "Active",
	            }),
	          });

	          this.getView().addDependent(this._oValueHelpDialog);
	        }

	        this._oValueHelpDialog.getBinding("items")?.filter([]);

	        return this._oValueHelpDialog;
	      },

	      _applyValueHelpSelection(sType, oRow) {
	        if (sType !== "order") {
	          return;
	        }

	        if (oRow.Plnbez) {
	          this.byId("plnbezInput").setValue(oRow.Plnbez);
	        }

	        if (oRow.Gstrp) {
	          this.byId("gstrpFromDate").setValue(this._normalizeSearchDate(oRow.Gstrp));
	        }

	        if (oRow.Gltrp) {
	          this.byId("gstrpToDate").setValue(this._normalizeSearchDate(oRow.Gltrp));
	        }
	      },
	    });
  },
);
