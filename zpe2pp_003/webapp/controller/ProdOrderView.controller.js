sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], (Controller, JSONModel, Filter, FilterOperator, MessageToast) => {
    "use strict";

    return Controller.extend("zpe2.pp003.zpe2pp003.controller.ProdOrderView", {
        onInit() {
            this._aStatusConfig = [
                {
                    key: "WAIT_APPROVAL",
                    title: "승인대기",
                    icon: "sap-icon://pending",
                    color: "#e9730c",
                    state: "Warning",
                    matchTexts: ["승인대기"]
                },
                {
                    key: "WAIT_PROD",
                    title: "생산대기",
                    icon: "sap-icon://request",
                    color: "#df8b00",
                    state: "Warning",
                    matchTexts: ["생산대기"]
                },
                {
                    key: "IN_PROD",
                    title: "생산중",
                    icon: "sap-icon://media-play",
                    color: "#0a6ed1",
                    state: "Information",
                    matchTexts: ["생산중", "진행중"]
                },
                {
                    key: "DONE",
                    title: "생산완료",
                    icon: "sap-icon://sys-enter-2",
                    color: "#30914c",
                    state: "Success",
                    matchTexts: ["생산완료", "완료"]
                },
                {
                    key: "REJECTED",
                    title: "반려",
                    icon: "sap-icon://decline",
                    color: "#e02b2b",
                    state: "Error",
                    matchTexts: ["반려"]
                },
                {
                    key: "CANCELED",
                    title: "생산취소",
                    icon: "sap-icon://sys-cancel-2",
                    color: "#6a7280",
                    state: "None",
                    matchTexts: ["생산취소", "취소"]
                }
            ];

            const oToday = this._startOfDay(new Date());

            this.getView().setModel(new JSONModel({
                baseDate: oToday,
                kpis: this._createEmptyKpiCards(),
                process: this._createEmptyStatusCards(),
                yield: [],
                ratioItems: [],
                ratioTotalQty: "0",
                ratioUnit: "EA",
                ratioScaleMax: "0 EA",
                periodText: this._createPeriodText(oToday)
            }), "dashboard");

            this._loadKpiData();
            this._loadYieldData();
            this._loadRatioData();
        },

        onBaseDateChange(oEvent) {
            const oDate = this._startOfDay(oEvent.getSource().getDateValue());

            if (!oDate) {
                MessageToast.show("기준일자를 선택해주세요.");
                return;
            }

            const oDashboardModel = this.getView().getModel("dashboard");
            oDashboardModel.setProperty("/baseDate", oDate);
            oDashboardModel.setProperty("/periodText", this._createPeriodText(oDate));
            this._loadKpiData();
            this._loadYieldData();
            this._loadRatioData();
        },

        _loadKpiData() {
            const oODataModel = this.getOwnerComponent().getModel();
            const oDashboardModel = this.getView().getModel("dashboard");

            if (!oODataModel) {
                MessageToast.show("생산오더 KPI 서비스 모델을 찾을 수 없습니다.");
                return;
            }

            const oBaseDate = oDashboardModel.getProperty("/baseDate");
            const oFromDate = this._addDays(oBaseDate, -6);
            const aFilters = [
                new Filter("Gstrp", FilterOperator.BT, oFromDate, oBaseDate)
            ];

            oDashboardModel.setProperty("/kpis", this._createEmptyKpiCards());
            oDashboardModel.setProperty("/process", this._createEmptyStatusCards());

            oODataModel.metadataLoaded().then(() => {
                oODataModel.read("/KpiSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const aRows = oData?.results || [];
                        const aKpiData = this._aggregateByMonStatus(aRows);
                        const aStatusCards = this._buildStatusCards(aKpiData);
                        const oTotalCard = this._createTotalCard(aKpiData);

                        oDashboardModel.setProperty("/kpis", [oTotalCard, ...aStatusCards]);
                        oDashboardModel.setProperty("/process", aStatusCards);
                    },
                    error: () => {
                        MessageToast.show("생산오더 KPI 조회에 실패했습니다.");
                    }
                });
            }).catch(() => {
                MessageToast.show("생산오더 KPI 서비스 메타데이터를 불러오지 못했습니다.");
            });
        },

        _loadYieldData() {
            const oYieldModel = this.getOwnerComponent().getModel("yield");
            const oDashboardModel = this.getView().getModel("dashboard");

            if (!oYieldModel) {
                MessageToast.show("생산량 추이 서비스 모델을 찾을 수 없습니다.");
                return;
            }

            const oBaseDate = oDashboardModel.getProperty("/baseDate");
            const oFromDate = this._addDays(oBaseDate, -6);
            const oToDate = this._endOfDay(oBaseDate);
            const aFilters = [
                new Filter("ProdDate", FilterOperator.BT, oFromDate, oToDate)
            ];

            oDashboardModel.setProperty("/yield", this._createEmptyYieldData(oFromDate));

            oYieldModel.metadataLoaded().then(() => {
                oYieldModel.read("/AufnrYieldSet", {
                    filters: aFilters,
                    success: (oData) => {
                        oDashboardModel.setProperty(
                            "/yield",
                            this._buildYieldData(oData?.results || [], oFromDate)
                        );
                    },
                    error: () => {
                        MessageToast.show("최근 7일 생산량 추이 조회에 실패했습니다.");
                    }
                });
            }).catch(() => {
                MessageToast.show("생산량 추이 서비스 메타데이터를 불러오지 못했습니다.");
            });
        },

        _loadRatioData() {
            const oRatioModel = this.getOwnerComponent().getModel("ratio");
            const oDashboardModel = this.getView().getModel("dashboard");

            if (!oRatioModel) {
                MessageToast.show("제품별 생산 비율 서비스 모델을 찾을 수 없습니다.");
                return;
            }

            const oBaseDate = oDashboardModel.getProperty("/baseDate");
            const oFromDate = this._addDays(oBaseDate, -6);
            const oToDate = this._endOfDay(oBaseDate);
            const aFilters = [
                new Filter("Gstrp", FilterOperator.BT, oFromDate, oToDate)
            ];

            oDashboardModel.setProperty("/ratioItems", []);
            oDashboardModel.setProperty("/ratioTotalQty", "0");
            oDashboardModel.setProperty("/ratioScaleMax", "0 EA");

            oRatioModel.metadataLoaded().then(() => {
                oRatioModel.read("/AufnrRatioSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const oRatioData = this._buildRatioData(oData?.results || []);

                        oDashboardModel.setProperty("/ratioItems", oRatioData.items);
                        oDashboardModel.setProperty("/ratioTotalQty", this._formatQuantity(oRatioData.totalQty));
                        oDashboardModel.setProperty("/ratioUnit", oRatioData.unit || "EA");
                        oDashboardModel.setProperty("/ratioScaleMax", oRatioData.scaleMaxText);
                    },
                    error: () => {
                        MessageToast.show("제품별 생산 비율 조회에 실패했습니다.");
                    }
                });
            }).catch(() => {
                MessageToast.show("제품별 생산 비율 서비스 메타데이터를 불러오지 못했습니다.");
            });
        },

        _buildRatioData(aRows) {
            const aColors = ["#0a6ed1", "#30914c", "#d17f00", "#6f42c1", "#18a6c8"];
            const mMaterials = aRows.reduce((mResult, oRow) => {
                const sKey = String(oRow.Plnbez || "").trim();

                if (!sKey) {
                    return mResult;
                }

                if (!mResult[sKey]) {
                    mResult[sKey] = {
                        plnbez: sKey,
                        maktx: oRow.Maktx || sKey,
                        prodQty: 0,
                        orderCnt: 0,
                        unit: oRow.Meins || ""
                    };
                }

                mResult[sKey].prodQty += Number(oRow.ProdQty || 0);
                mResult[sKey].orderCnt += Number(oRow.OrderCnt || 0);
                mResult[sKey].unit = oRow.Meins || mResult[sKey].unit;
                return mResult;
            }, {});
            const aItems = Object.values(mMaterials)
                .sort((oLeft, oRight) => oRight.prodQty - oLeft.prodQty)
                .slice(0, 5);
            const fTotalQty = aItems.reduce((fSum, oItem) => fSum + oItem.prodQty, 0);
            const fMaxQty = Math.max(0, ...aItems.map((oItem) => oItem.prodQty));
            const fScaleMax = fMaxQty ? fMaxQty * 1.2 : 0;
            const sUnit = aItems[0]?.unit || "EA";

            return {
                totalQty: fTotalQty,
                unit: sUnit,
                scaleMaxText: `${this._formatQuantity(fScaleMax)} ${sUnit}`,
                items: aItems.map((oItem, iIndex) => {
                    const fRatio = fTotalQty ? (oItem.prodQty / fTotalQty) * 100 : 0;

                    return {
                        ...oItem,
                        color: aColors[iIndex % aColors.length],
                        rank: String(iIndex + 1),
                        barWidth: `${fScaleMax ? (oItem.prodQty / fScaleMax) * 100 : 0}%`,
                        prodQtyText: `${this._formatQuantity(oItem.prodQty)} ${oItem.unit || sUnit}`,
                        ratio: fRatio,
                        ratioText: `${this._formatPercent(fRatio)}% (${this._formatQuantity(oItem.prodQty)} ${oItem.unit || ""})`.trim()
                    };
                })
            };
        },

        _buildYieldData(aRows, oFromDate) {
            const mByDate = aRows.reduce((mResult, oRow) => {
                const oProdDate = this._toDate(oRow.ProdDate);

                if (!oProdDate) {
                    return mResult;
                }

                const sKey = this._formatDisplayDate(oProdDate);

                if (!mResult[sKey]) {
                    mResult[sKey] = {
                        prodQty: 0,
                        orderCnt: 0
                    };
                }

                mResult[sKey].prodQty += Number(oRow.ProdQty || 0);
                mResult[sKey].orderCnt += Number(oRow.OrderCnt || 0);
                return mResult;
            }, {});

            return this._createEmptyYieldData(oFromDate).map((oDay) => ({
                ...oDay,
                ...(mByDate[oDay.date] || {})
            }));
        },

        _createEmptyYieldData(oFromDate) {
            return Array.from({ length: 7 }, (_, iIndex) => {
                const oDate = this._addDays(oFromDate, iIndex);
                const sDate = this._formatDisplayDate(oDate);

                return {
                    date: sDate,
                    label: `${String(oDate.getMonth() + 1).padStart(2, "0")}/${String(oDate.getDate()).padStart(2, "0")}`,
                    prodQty: 0,
                    orderCnt: 0
                };
            });
        },

        _toDate(vValue) {
            if (vValue instanceof Date) {
                return this._startOfDay(vValue);
            }

            const sValue = String(vValue || "");
            const aMatch = /\/Date\((-?\d+)(?:[+-]\d+)?\)\//.exec(sValue);

            if (aMatch) {
                return this._startOfDay(new Date(Number(aMatch[1])));
            }

            if (/^\d{8}$/.test(sValue)) {
                return new Date(
                    Number(sValue.slice(0, 4)),
                    Number(sValue.slice(4, 6)) - 1,
                    Number(sValue.slice(6, 8))
                );
            }

            const oDate = new Date(vValue);
            return Number.isNaN(oDate.getTime()) ? null : this._startOfDay(oDate);
        },

        _aggregateByMonStatus(aRows) {
            const mStatus = {};

            aRows.forEach((oRow) => {
                const sKey = String(oRow.MonStatus || "").trim();

                if (!sKey) {
                    return;
                }

                if (!mStatus[sKey]) {
                    mStatus[sKey] = {
                        MonStatus: sKey,
                        MonStatusTxt: oRow.MonStatusTxt || "",
                        OrderCnt: 0,
                        PlanQty: 0,
                        Meins: oRow.Meins || ""
                    };
                }

                mStatus[sKey].OrderCnt += Number(oRow.OrderCnt || 0);
                mStatus[sKey].PlanQty += Number(oRow.PlanQty || 0);
                mStatus[sKey].Meins = oRow.Meins || mStatus[sKey].Meins;
            });

            return Object.values(mStatus);
        },

        _buildStatusCards(aRows) {
            const mByKey = this._aStatusConfig.reduce((mResult, oConfig) => {
                mResult[oConfig.key] = {
                    count: 0,
                    planQty: 0,
                    unit: ""
                };
                return mResult;
            }, {});

            aRows.forEach((oRow) => {
                const oConfig = this._findStatusConfig(oRow);

                if (!oConfig) {
                    return;
                }

                mByKey[oConfig.key].count += Number(oRow.OrderCnt || 0);
                mByKey[oConfig.key].planQty += Number(oRow.PlanQty || 0);
                mByKey[oConfig.key].unit = oRow.Meins || mByKey[oConfig.key].unit;
            });

            const iTotalCount = Object.values(mByKey).reduce((iSum, oItem) => iSum + oItem.count, 0);

            return this._aStatusConfig.map((oConfig) => {
                const oValue = mByKey[oConfig.key];
                const fPercent = iTotalCount ? (oValue.count / iTotalCount) * 100 : 0;

                return {
                    key: oConfig.key,
                    title: oConfig.title,
                    icon: oConfig.icon,
                    color: oConfig.color,
                    state: oConfig.state,
                    isTotal: "false",
                    count: oValue.count,
                    subText: `${this._formatPercent(fPercent)}%`,
                    planQtyText: `${this._formatQuantity(oValue.planQty)} ${oValue.unit || ""}`.trim()
                };
            });
        },

        _findStatusConfig(oRow) {
            const sStatus = String(oRow.MonStatus || "").trim();
            const sText = String(oRow.MonStatusTxt || "").trim();

            return this._aStatusConfig.find((oConfig, iIndex) =>
                sStatus === String(iIndex + 1) ||
                sStatus === oConfig.key ||
                oConfig.matchTexts.some((sMatchText) => sText.includes(sMatchText))
            );
        },

        _createEmptyStatusCards() {
            return this._aStatusConfig.map((oConfig) => ({
                key: oConfig.key,
                title: oConfig.title,
                icon: oConfig.icon,
                color: oConfig.color,
                    state: oConfig.state,
                    isTotal: "false",
                    count: 0,
                subText: "0.0%",
                planQtyText: "0"
            }));
        },

        _createEmptyKpiCards() {
            return [this._createTotalCard([]), ...this._createEmptyStatusCards()];
        },

        _createTotalCard(aKpiData) {
            const oTotal = aKpiData.reduce((oResult, oRow) => {
                oResult.count += Number(oRow.OrderCnt || 0);
                oResult.planQty += Number(oRow.PlanQty || 0);
                oResult.unit = oRow.Meins || oResult.unit;
                return oResult;
            }, {
                count: 0,
                planQty: 0,
                unit: ""
            });

            return {
                key: "TOTAL",
                title: "조회기간 총 생산오더",
                icon: "sap-icon://activities",
                color: "#0a6ed1",
                state: "Information",
                isTotal: "true",
                count: oTotal.count,
                subText: `계획수량 ${this._formatQuantity(oTotal.planQty)} ${oTotal.unit || ""}`.trim(),
                planQtyText: `${this._formatQuantity(oTotal.planQty)} ${oTotal.unit || ""}`.trim()
            };
        },

        _createPeriodText(oBaseDate) {
            const oSevenFrom = this._addDays(oBaseDate, -6);
            const oThirtyFrom = this._addDays(oBaseDate, -29);
            const sBase = this._formatDisplayDate(oBaseDate);

            return {
                status: `상태 현황 : 최근 7일 (${this._formatDisplayDate(oSevenFrom)} ~ ${sBase})`,
                ratio: `제품 비율 : 최근 30일 (${this._formatDisplayDate(oThirtyFrom)} ~ ${sBase})`,
                today: `오늘 목록 : 기준일자 (${sBase})`,
                todayTitle: `(${sBase})`
            };
        },

        _addDays(oDate, iDays) {
            const oResult = new Date(oDate.getTime());
            oResult.setDate(oResult.getDate() + iDays);
            return oResult;
        },

        _startOfDay(oDate) {
            if (!oDate) {
                return null;
            }

            const oResult = new Date(oDate.getTime());
            oResult.setHours(0, 0, 0, 0);
            return oResult;
        },

        _endOfDay(oDate) {
            const oResult = this._startOfDay(oDate);
            oResult.setHours(23, 59, 59, 999);
            return oResult;
        },

        _formatDisplayDate(oDate) {
            return this._formatDateParts(oDate).join("-");
        },

        _formatDateParts(oDate) {
            const iYear = oDate.getFullYear();
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sDay = String(oDate.getDate()).padStart(2, "0");

            return [iYear, sMonth, sDay];
        },

        _formatQuantity(fValue) {
            return Number(fValue || 0).toLocaleString("ko-KR", {
                maximumFractionDigits: 3
            });
        },

        _formatPercent(fValue) {
            return Number(fValue || 0).toLocaleString("ko-KR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            });
        }
    });
});
