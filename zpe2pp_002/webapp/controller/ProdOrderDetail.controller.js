sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], (Controller, History, JSONModel, Filter, FilterOperator, MessageToast) => {
    "use strict";

    return Controller.extend("zpe2.pp002.zpe2pp002.controller.ProdOrderDetail", {
        onInit() {
            this.getView().setModel(new JSONModel({
                routeHeader: {},
                routs: [],
                items: [],
                allRegistered: false
            }), "detail");

            this.getOwnerComponent().getRouter()
                .getRoute("RouteProdOrderDetail")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        onNavBack() {
            const sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
                return;
            }

            this.getOwnerComponent().getRouter().navTo("RouteProdOrderView", {}, true);
        },

        onPerformanceTimeChange(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oEvent.getSource().getBindingContext("detail");
            const sFieldPath = this._getValueBindingPath(oSource);

            if (!oContext || !this._isPerformanceEditable()) {
                return;
            }

            if (sFieldPath) {
                this.getView().getModel("detail").setProperty(`${oContext.getPath()}/${sFieldPath}`, oSource.getValue());
            }

            if (this._isStartDateTimeField(oSource)) {
                this._applyAutoEndDateTime(oContext.getPath());
            }

            this._updateElapsedTime(oContext.getPath());
        },

        onPressRegisterPerformance(oEvent) {
            if (!this._isPerformanceEditable()) {
                MessageToast.show("생산중인 오더만 실적 입력이 가능합니다.");
                return;
            }

            const oContext = oEvent.getSource().getBindingContext("detail");
            const oRow = oContext?.getObject();
            const oModel = this.getView().getModel();

            if (!oRow) {
                return;
            }

            this._updateElapsedTime(oContext.getPath());

            if (!this._hasPerformanceTime(oRow)) {
                MessageToast.show("작업 시작/종료 일시를 입력해주세요.");
                return;
            }

            const oPayload = this._createProdRoutPayload(oRow);

            oModel.create("/ProdRoutSet", oPayload, {
                success: () => {
                    this.getView().getModel("detail").setProperty(`${oContext.getPath()}/_registered`, true);
                    this._updateAllRegistered();
                    oModel.refresh();
                    MessageToast.show("실적등록 성공");
                },
                error: () => {
                    MessageToast.show("실적등록 실패");
                }
            });
        },

        onPressEditPerformance(oEvent) {
            if (!this._isPerformanceEditable()) {
                MessageToast.show("생산중인 오더만 실적 수정이 가능합니다.");
                return;
            }

            const oContext = oEvent.getSource().getBindingContext("detail");
            const oRow = oContext?.getObject();
            const oModel = this.getView().getModel();

            if (!oRow) {
                return;
            }

            this._updateElapsedTime(oContext.getPath());

            oModel.update(this._createProdRoutKeyPath(oRow), this._createProdRoutPayload(oRow), {
                success: () => {
                    oModel.refresh();
                    MessageToast.show("실적수정 성공");
                },
                error: () => {
                    MessageToast.show("실적수정 실패");
                }
            });
        },

        onPressDeletePerformance(oEvent) {
            if (!this._isPerformanceEditable()) {
                MessageToast.show("생산중인 오더만 실적 삭제가 가능합니다.");
                return;
            }

            const oContext = oEvent.getSource().getBindingContext("detail");
            const oDetailModel = this.getView().getModel("detail");
            const oModel = this.getView().getModel();
            const sPath = oContext?.getPath();
            const oRow = oContext?.getObject();

            if (!sPath || !oRow) {
                return;
            }

            oModel.remove(this._createProdRoutKeyPath(oRow), {
                success: () => {
                    oDetailModel.setProperty(`${sPath}/Isdd`, this._getToday());
                    oDetailModel.setProperty(`${sPath}/Isdz`, "");
                    oDetailModel.setProperty(`${sPath}/Iedd`, this._getToday());
                    oDetailModel.setProperty(`${sPath}/Iedz`, "");
                    oDetailModel.setProperty(`${sPath}/Ismnw`, "0");
                    oDetailModel.setProperty(`${sPath}/_registered`, false);
                    this._updateAllRegistered();
                    oModel.refresh();
                    MessageToast.show("실적삭제 성공");
                },
                error: () => {
                    MessageToast.show("실적삭제 실패");
                }
            });
        },

        onPressCompleteProduction() {
            if (!this._isPerformanceEditable()) {
                MessageToast.show("생산중인 오더만 생산완료 처리할 수 있습니다.");
                return;
            }

            if (!this._areAllRoutsRegistered()) {
                MessageToast.show("모든 공정 실적을 등록해야 생산완료할 수 있습니다.");
                return;
            }

            const oModel = this.getView().getModel();
            const sAufnr = this.getView().getBindingContext()?.getProperty("Aufnr");

            if (!sAufnr) {
                MessageToast.show("생산오더번호가 없습니다.");
                return;
            }

            oModel.update(this._createProdCompleteKeyPath(sAufnr), this._createProdCompletePayload(), {
                success: () => {
                    oModel.refresh();
                    MessageToast.show(`${sAufnr}가 생산완료되었습니다.`);
                },
                error: () => {
                    MessageToast.show("생산완료 실패");
                }
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

        formatQuantity(vQuantity, sUnit) {
            if (!vQuantity && !sUnit) {
                return "";
            }

            return `${vQuantity || ""} ${sUnit || ""}`.trim();
        },

        formatDateRange(sStartDate, sEndDate) {
            if (sStartDate && sEndDate) {
                return `${sStartDate} ~ ${sEndDate}`;
            }

            return sStartDate || sEndDate || "";
        },

        formatPerformanceEditable(sStat) {
            return sStat === "1";
        },

        formatRegisterButtonVisible(sStat, bRegistered) {
            return this.formatPerformanceEditable(sStat) && !bRegistered;
        },

        formatChangeButtonsVisible(sStat, bRegistered, sStartDate, sStartTime, sEndDate, sEndTime) {
            return this.formatPerformanceEditable(sStat) && Boolean(bRegistered) && this._hasPerformanceTime({
                Isdd: sStartDate,
                Isdz: sStartTime,
                Iedd: sEndDate,
                Iedz: sEndTime
            });
        },

        formatCompleteButtonEnabled(sStat, bAllRegistered) {
            return this.formatPerformanceEditable(sStat) && Boolean(bAllRegistered);
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

            this._readProdRoutSet(sAufnr);
            this._readProdItemSet(sAufnr);
        },

        _readProdRoutSet(sAufnr) {
            const oDetailModel = this.getView().getModel("detail");

            oDetailModel.setData({
                routeHeader: {},
                routs: [],
                items: oDetailModel.getProperty("/items") || [],
                allRegistered: false
            });

            this.getOwnerComponent().getModel().read("/ProdRoutSet", {
                filters: [
                    new Filter("Aufnr", FilterOperator.EQ, sAufnr)
                ],
                success: (oData) => {
                    const sToday = this._getToday();
                    const aRouts = (oData.results || []).map((oRow) => {
                        const oRout = Object.assign({}, oRow);

                        oRout.Isdd = this._normalizeDate(oRout.Isdd) || sToday;
                        oRout.Iedd = this._normalizeDate(oRout.Iedd) || sToday;
                        oRout.Isdz = this._normalizeTime(oRout.Isdz);
                        oRout.Iedz = this._normalizeTime(oRout.Iedz);
                        oRout._registered = this._hasPerformanceTime(oRout);
                        oRout.Ismnw = this._calculateElapsedMinutes(oRout);

                        return oRout;
                    });
                    const oFirst = aRouts[0] || {};

                    oDetailModel.setData({
                        routeHeader: {
                            Werks: oFirst.Werks || "",
                            Plnnr: oFirst.Plnnr || "",
                            KtextR: oFirst.KtextR || ""
                        },
                        routs: aRouts,
                        items: oDetailModel.getProperty("/items") || [],
                        allRegistered: this._areAllRoutsRegistered(aRouts)
                    });
                },
                error: () => {
                    MessageToast.show("공정 정보를 불러오지 못했습니다.");
                }
            });
        },

        _readProdItemSet(sAufnr) {
            const oDetailModel = this.getView().getModel("detail");

            oDetailModel.setProperty("/items", []);

            this.getOwnerComponent().getModel().read("/ProdItemSet", {
                filters: [
                    new Filter("Aufnr", FilterOperator.EQ, sAufnr)
                ],
                success: (oData) => {
                    oDetailModel.setProperty("/items", oData.results || []);
                },
                error: () => {
                    MessageToast.show("배치별 투입 재고를 불러오지 못했습니다.");
                }
            });
        },

        _updateElapsedTime(sPath) {
            const oModel = this.getView().getModel("detail");
            const oRow = oModel.getProperty(sPath);
            const sElapsedMinutes = this._calculateElapsedMinutes(oRow);

            oModel.setProperty(`${sPath}/Ismnw`, sElapsedMinutes);
        },

        _applyAutoEndDateTime(sPath) {
            const oModel = this.getView().getModel("detail");
            const oRow = oModel.getProperty(sPath);

            if (!oRow?.Isdz) {
                return;
            }

            if (!oRow.Isdd) {
                oModel.setProperty(`${sPath}/Isdd`, this._getToday());
                oRow.Isdd = this._getToday();
            }

            const oStart = this._createDateTime(oRow.Isdd, oRow.Isdz);
            const iPlannedMinutes = this._calculatePlannedMinutes(oRow);

            if (!oStart || !iPlannedMinutes) {
                return;
            }

            const oEnd = new Date(oStart.getTime() + iPlannedMinutes * 60000);

            oModel.setProperty(`${sPath}/Iedd`, this._formatDate(oEnd));
            oModel.setProperty(`${sPath}/Iedz`, this._formatTime(oEnd));
        },

        _calculatePlannedMinutes(oRow) {
            const fWorkMinutes = this._parseNumber(oRow?.Vgw02);
            const fOrderQuantity = this._parseNumber(this.getView().getBindingContext()?.getProperty("Gamng"));
            const fBaseQuantity = this._parseNumber(oRow?.Bmsch) || 100;

            if (!fWorkMinutes) {
                return 0;
            }

            if (!fOrderQuantity || !fBaseQuantity) {
                return Math.round(fWorkMinutes);
            }

            return Math.round(fWorkMinutes * (fOrderQuantity / fBaseQuantity));
        },

        _createProdRoutPayload(oRow) {
            return {
                Aufnr: oRow.Aufnr || this.getView().getBindingContext()?.getProperty("Aufnr") || "",
                Vornr: oRow.Vornr || "",
                Werks: oRow.Werks || "",
                Plnnr: oRow.Plnnr || "",
                KtextR: oRow.KtextR || "",
                Arbpl: oRow.Arbpl || "",
                KtextW: oRow.KtextW || "",
                Ltxa1: oRow.Ltxa1 || "",
                Vgw02: this._formatDecimal(oRow.Vgw02),
                Vge02: oRow.Vge02 || "",
                Bmsch: this._formatDecimal(oRow.Bmsch),
                Meins: oRow.Meins || "",
                Lgort: oRow.Lgort || "",
                Isdd: this._normalizeDate(oRow.Isdd),
                Isdz: this._normalizeTime(oRow.Isdz),
                Iedd: this._normalizeDate(oRow.Iedd),
                Iedz: this._normalizeTime(oRow.Iedz),
                Ismnw: this._formatDecimal(oRow.Ismnw),
                Ernam: oRow.Ernam || "",
                Erdat: this._normalizeDate(oRow.Erdat),
                Erzet: this._normalizeTime(oRow.Erzet),
                Aenam: oRow.Aenam || "",
                Aedat: this._normalizeDate(oRow.Aedat),
                Aezet: this._normalizeTime(oRow.Aezet)
            };
        },

        _createProdRoutKeyPath(oRow) {
            return "/" + this.getView().getModel().createKey("ProdRoutSet", {
                Aufnr: oRow.Aufnr || this.getView().getBindingContext()?.getProperty("Aufnr") || "",
                Vornr: oRow.Vornr || ""
            });
        },

        _createProdCompletePayload() {
            const oOrder = this.getView().getBindingContext()?.getObject() || {};

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
                Gstrp: this._normalizeDate(oOrder.Gstrp),
                Gltrp: this._normalizeDate(oOrder.Gltrp),
                Ordat: this._normalizeDate(oOrder.Ordat)
            };
        },

        _createProdCompleteKeyPath(sAufnr) {
            return "/" + this.getView().getModel().createKey("ProdCompleteSet", {
                Aufnr: sAufnr
            });
        },

        _updateAllRegistered() {
            this.getView().getModel("detail").setProperty("/allRegistered", this._areAllRoutsRegistered());
        },

        _areAllRoutsRegistered(aRouts) {
            const aRows = aRouts || this.getView().getModel("detail").getProperty("/routs") || [];

            return aRows.length > 0 && aRows.every((oRow) => oRow._registered && this._hasPerformanceTime(oRow));
        },

        _isPerformanceEditable() {
            return this.getView().getBindingContext()?.getProperty("Stat") === "1";
        },

        _calculateElapsedMinutes(oRow) {
            const oStart = this._createDateTime(oRow?.Isdd, oRow?.Isdz);
            const oEnd = this._createDateTime(oRow?.Iedd, oRow?.Iedz);

            if (!oStart || !oEnd || oEnd < oStart) {
                return "0";
            }

            return String(Math.round((oEnd.getTime() - oStart.getTime()) / 60000));
        },

        _createDateTime(sDate, sTime) {
            const sNormalizedDate = this._normalizeDate(sDate);
            const sNormalizedTime = this._normalizeTime(sTime);

            if (!sNormalizedDate || !sNormalizedTime) {
                return null;
            }

            const oDateTime = new Date(`${sNormalizedDate}T${sNormalizedTime}`);

            if (Number.isNaN(oDateTime.getTime())) {
                return null;
            }

            return oDateTime;
        },

        _normalizeDate(sDate) {
            if (!sDate) {
                return "";
            }

            const sValue = String(sDate).trim();

            if (!sValue || sValue === "00000000" || sValue === "0000-00-00" || sValue === "0000.00.00") {
                return "";
            }

            if (/^\d{8}$/.test(sValue)) {
                return `${sValue.slice(0, 4)}-${sValue.slice(4, 6)}-${sValue.slice(6, 8)}`;
            }

            return sValue.replace(/\./g, "-");
        },

        _normalizeTime(sTime) {
            if (!sTime) {
                return "";
            }

            const sValue = String(sTime).trim();

            if (!sValue || sValue === "000000" || sValue === "00:00:00") {
                return "";
            }

            if (/^\d{6}$/.test(sValue)) {
                return `${sValue.slice(0, 2)}:${sValue.slice(2, 4)}:${sValue.slice(4, 6)}`;
            }

            if (/^\d{2}:\d{2}$/.test(sValue)) {
                return `${sValue}:00`;
            }

            return sValue;
        },

        _isStartDateTimeField(oControl) {
            const sPath = this._getValueBindingPath(oControl);

            return sPath === "Isdd" || sPath === "Isdz";
        },

        _getValueBindingPath(oControl) {
            const oBindingInfo = oControl.getBindingInfo("value");

            return oBindingInfo?.parts?.[0]?.path || oBindingInfo?.path || "";
        },

        _parseNumber(vValue) {
            if (vValue === null || vValue === undefined || vValue === "") {
                return 0;
            }

            const fValue = Number(String(vValue).replace(/,/g, ""));

            return Number.isFinite(fValue) ? fValue : 0;
        },

        _formatDecimal(vValue) {
            const fValue = this._parseNumber(vValue);

            return fValue ? String(fValue) : "0";
        },

        _formatDate(oDate) {
            const sYear = String(oDate.getFullYear());
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sDate = String(oDate.getDate()).padStart(2, "0");

            return `${sYear}-${sMonth}-${sDate}`;
        },

        _formatTime(oDate) {
            const sHours = String(oDate.getHours()).padStart(2, "0");
            const sMinutes = String(oDate.getMinutes()).padStart(2, "0");
            const sSeconds = String(oDate.getSeconds()).padStart(2, "0");

            return `${sHours}:${sMinutes}:${sSeconds}`;
        },

        _getToday() {
            const oToday = new Date();

            return this._formatDate(oToday);
        },

        _hasPerformanceTime(oRow) {
            return Boolean(oRow?.Isdd && oRow?.Isdz && oRow?.Iedd && oRow?.Iedz);
        }
    });
});
