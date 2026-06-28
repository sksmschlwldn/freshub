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
                prodOrders: [],
                materials: [],
                labors: [],
                overheads: []
            }), "detail");
            this.getView().setModel(new JSONModel(this._createSummaryModelData(this._createEmptySummary())), "summary");

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

        onPressPrintPdf() {
            const oPrintWindow = window.open("", "_blank");

            if (!oPrintWindow) {
                MessageToast.show("팝업 차단을 해제한 후 다시 시도해주세요.");
                return;
            }

            oPrintWindow.document.open();
            oPrintWindow.document.write(this._createCostStatementHtml());
            oPrintWindow.document.close();
            oPrintWindow.focus();
            oPrintWindow.print();
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
                this._readEntitySet(oModel, "/ActualCostSet", aFilters),
                this._readEntitySet(oModel, "/ActProdOrderSet", aFilters),
                this._readEntitySet(oModel, "/ActMatSet", aFilters),
                this._readEntitySet(oModel, "/ActLabSet", aFilters),
                this._readEntitySet(oModel, "/ActIndSet", aFilters)
            ]).then(([aActualCosts, aProdOrders, aMaterials, aLabors, aOverheads]) => {
                const oSummary = this._createSummary(aProdOrders);
                const oActualCost = aActualCosts[0] || {};
                const oMergedSelection = {
                    ...this.getView().getModel("detail").getProperty("/selection"),
                    ...oActualCost
                };

                oView.getModel("detail").setProperty("/selection", oMergedSelection);
                oView.getModel("detail").setProperty("/prodOrders", aProdOrders);
                oView.getModel("detail").setProperty("/materials", aMaterials);
                oView.getModel("detail").setProperty("/labors", aLabors);
                oView.getModel("detail").setProperty("/overheads", aOverheads);
                oView.getModel("summary").setData(this._createSummaryModelData(oSummary));
                oView.setBusy(false);
            }).catch(() => {
                oView.getModel("detail").setProperty("/prodOrders", []);
                oView.getModel("detail").setProperty("/materials", []);
                oView.getModel("detail").setProperty("/labors", []);
                oView.getModel("detail").setProperty("/overheads", []);
                oView.getModel("summary").setData(this._createSummaryModelData(this._createEmptySummary()));
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

        _createSummaryModelData(oSummary) {
            return {
                ...oSummary,
                donutHtml: this._createDonutChartHtml(oSummary),
                rows: [{
                    ...oSummary,
                    Aufnr: "합계",
                    Qiactdat: ""
                }]
            };
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

        _createDonutChartHtml(oSummary) {
            const aItems = this._createDonutChartItems(oSummary);
            const fMatlPct = aItems[0].percent;
            const fLabrPct = fMatlPct + aItems[1].percent;
            const sGradient = oSummary.Wkg00
                ? `conic-gradient(${aItems[0].color} 0 ${fMatlPct}%, ${aItems[1].color} ${fMatlPct}% ${fLabrPct}%, ${aItems[2].color} ${fLabrPct}% 100%)`
                : "conic-gradient(var(--actualCostDonutEmpty) 0 100%)";
            const sTotalAmount = this._formatNumber(oSummary.Wkg00, {
                round: oSummary.Waers === "KRW"
            });
            const sCurrencyText = this._formatCurrencyText(oSummary.Waers);
            const sLegendHtml = aItems.map((oItem) => `
                <div class="actualCostDonutLegendItem">
                    <span class="actualCostDonutLegendDot ${oItem.dotClass}"></span>
                    <span class="actualCostDonutLegendName">${oItem.name}</span>
                    <span class="actualCostDonutLegendValue">${oItem.amountText} (${oItem.percentText})</span>
                </div>
            `).join("");

            return `
                <div class="actualCostDonutWrap">
                    <div class="actualCostDonut" style="background:${sGradient}">
                        <div class="actualCostDonutHole">
                            <div class="actualCostDonutTotal">${sTotalAmount}</div>
                            <div class="actualCostDonutCurrency">${sCurrencyText}</div>
                        </div>
                    </div>
                    <div class="actualCostDonutLegend">${sLegendHtml}</div>
                </div>
            `;
        },

        _createDonutChartItems(oSummary) {
            return [
                this._createDonutChartItem("재료비", oSummary.Dmatl, oSummary, "var(--actualCostDonutMaterial)", "actualCostDonutLegendDotMaterial"),
                this._createDonutChartItem("노무비", oSummary.Dlabr, oSummary, "var(--actualCostDonutLabor)", "actualCostDonutLegendDotLabor"),
                this._createDonutChartItem("간접비", oSummary.Mohad, oSummary, "var(--actualCostDonutOverhead)", "actualCostDonutLegendDotOverhead")
            ];
        },

        _createDonutChartItem(sName, fAmount, oSummary, sColor, sDotClass) {
            const fPercent = oSummary.Wkg00 ? (fAmount / oSummary.Wkg00) * 100 : 0;

            return {
                name: sName,
                color: sColor,
                dotClass: sDotClass,
                percent: fPercent,
                percentText: `${fPercent.toFixed(1)}%`,
                amountText: this.formatCurrencyAmount(fAmount, oSummary.Waers)
            };
        },

        _createCostStatementHtml() {
            const oDetailModel = this.getView().getModel("detail");
            const oSummary = this.getView().getModel("summary").getData();
            const oSelection = oDetailModel.getProperty("/selection") || {};
            const aOverheads = oDetailModel.getProperty("/overheads") || [];
            const sPrintDateTime = this._formatDateTime(new Date());
            const sPeriodText = this._formatStatementPeriod(oSelection.Bdatj, oSelection.Poper);
            const sStatementMonthText = this._formatStatementMonth(oSelection.Bdatj, oSelection.Poper);
            const sCalcDate = this._formatDateObject(new Date());
            const sMaterialAmount = this.formatCurrencyAmount(oSummary.Dmatl, oSummary.Waers);
            const sLaborAmount = this.formatCurrencyAmount(oSummary.Dlabr, oSummary.Waers);
            const sOverheadAmount = this.formatCurrencyAmount(oSummary.Mohad, oSummary.Waers);
            const sTotalAmount = this.formatCurrencyAmount(oSummary.Wkg00, oSummary.Waers);
            const sMaterialRate = this._formatPercent(oSummary.Dmatl, oSummary.Wkg00);
            const sLaborRate = this._formatPercent(oSummary.Dlabr, oSummary.Wkg00);
            const sOverheadRate = this._formatPercent(oSummary.Mohad, oSummary.Wkg00);
            const sTotalRate = oSummary.Wkg00 ? "100.0%" : "0.0%";
            const sLogoUrl = new URL(sap.ui.require.toUrl("zpe2/co001/zpe2co001/images/logo.png"), window.location.href).href;
            const sOverheadRows = aOverheads.length
                ? aOverheads.map((oItem) => `
                    <tr>
                        <td>${this._escapeHtml(oItem.Kstar)}</td>
                        <td>${this._escapeHtml(oItem.Ktext)}</td>
                        <td class="amount">${this._escapeHtml(this.formatCurrencyAmount(oItem.Wkg00, oItem.Waers || oSummary.Waers))}</td>
                        <td class="rate">${this._formatPercent(this._toNumber(oItem.Wkg00), oSummary.Wkg00)}</td>
                    </tr>
                `).join("")
                : "<tr><td colspan=\"4\" class=\"empty\">조회된 제조경비 내역이 없습니다.</td></tr>";

            return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>제조원가명세서</title>
    <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        html, body, .statement, .section-mark, th, .subtotal, .grand-total {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body { color: #111827; font-family: Arial, "Malgun Gothic", sans-serif; font-size: 12px; margin: 0; }
        .statement { border: 2px solid #0b7f2a; margin: 0 auto; max-width: 730px; padding: 20px 32px 24px; }
        .header { align-items: center; border-bottom: 1px solid #9aa5b1; display: flex; justify-content: space-between; padding-bottom: 14px; }
        .logo { display: block; height: auto; max-height: 46px; object-fit: contain; width: 128px; }
        .title { flex: 1; font-size: 26px; font-weight: 900; text-align: center; }
        .meta { border-bottom: 1px solid #9aa5b1; display: grid; gap: 8px 28px; grid-template-columns: 78px 1fr 78px 1fr; padding: 12px 0; }
        .meta-label { font-weight: 800; }
        .section { margin-top: 15px; }
        .section-title { align-items: center; color: #087a26; display: flex; font-size: 16px; font-weight: 900; gap: 8px; margin-bottom: 7px; }
        .section-mark { background: #087a26; border-radius: 3px; color: #fff; display: inline-block; min-width: 32px; padding: 5px 0; text-align: center; }
        table { border-collapse: collapse; table-layout: fixed; width: 100%; }
        th { background: #edf7ee; border: 1px solid #9fbea6; font-weight: 900; padding: 6px 8px; text-align: center; }
        td { border: 1px solid #c7d1cc; padding: 6px 8px; }
        .amount, .rate { text-align: right; }
        .subtotal { background: #f7fbf7; border-bottom: 1px solid #c7d1cc; color: #087a26; display: grid; font-weight: 900; grid-template-columns: 1fr 140px 90px; padding: 9px 10px; }
        .grand-total { background: #087a26; color: #fff; display: grid; font-size: 16px; font-weight: 900; grid-template-columns: 1fr 150px 90px; margin-top: 12px; padding: 10px 12px; }
        .empty { color: #64748b; text-align: center; }
        .footer { border-top: 1px solid #9aa5b1; color: #334155; font-size: 10.5px; line-height: 1.6; margin-top: 18px; padding-top: 10px; }
        .print-date { text-align: right; }
        @media print {
            html, body, .statement, .section-mark, th, .subtotal, .grand-total {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="statement">
        <div class="header">
            <img class="logo" src="${sLogoUrl}" alt="FRESHUB">
            <div class="title">제조원가명세서</div>
            <div style="width:120px"></div>
        </div>
        <div class="meta">
            <div class="meta-label">제품번호</div><div>${this._escapeHtml(oSelection.Matnr)}</div>
            <div class="meta-label">산정일</div><div>${sCalcDate}</div>
            <div class="meta-label">제품명</div><div>${this._escapeHtml(oSelection.Maktx || "-")}</div>
            <div class="meta-label">단위</div><div>KRW (원)</div>
            <div class="meta-label">산정기간</div><div>${sPeriodText}</div>
            <div></div><div></div>
        </div>

        <div class="section">
            <div class="section-title"><span class="section-mark">I.</span> 재료비</div>
            <table>
                <thead><tr><th>구분</th><th>내역</th><th>금액(원)</th><th>비율(%)</th></tr></thead>
                <tbody><tr><td>직접재료비</td><td>재료비 합계</td><td class="amount">${sMaterialAmount}</td><td class="rate">${sMaterialRate}</td></tr></tbody>
            </table>
            <div class="subtotal"><span>재료비 합계</span><span class="amount">${sMaterialAmount}</span><span class="rate">${sMaterialRate}</span></div>
        </div>

        <div class="section">
            <div class="section-title"><span class="section-mark">II.</span> 노무비</div>
            <table>
                <thead><tr><th>구분</th><th>내역</th><th>금액(원)</th><th>비율(%)</th></tr></thead>
                <tbody><tr><td>직접노무비</td><td>노무비 합계</td><td class="amount">${sLaborAmount}</td><td class="rate">${sLaborRate}</td></tr></tbody>
            </table>
            <div class="subtotal"><span>노무비 합계</span><span class="amount">${sLaborAmount}</span><span class="rate">${sLaborRate}</span></div>
        </div>

        <div class="section">
            <div class="section-title"><span class="section-mark">III.</span> 제조경비</div>
            <table>
                <thead><tr><th>원가요소코드</th><th>원가요소명</th><th>금액(원)</th><th>비율(%)</th></tr></thead>
                <tbody>${sOverheadRows}</tbody>
            </table>
            <div class="subtotal"><span>제조경비 합계</span><span class="amount">${sOverheadAmount}</span><span class="rate">${sOverheadRate}</span></div>
        </div>

        <div class="grand-total"><span>총 제조원가</span><span class="amount">${sTotalAmount}</span><span class="rate">${sTotalRate}</span></div>

        <div class="footer">
            <div>※ 본 제조원가명세서는 ${sStatementMonthText} 기준 실제원가 산정 결과를 기반으로 작성되었습니다.</div>
            <div class="print-date">출력일시 : ${sPrintDateTime}</div>
        </div>
    </div>
</body>
</html>`;
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

        formatTime(vTime, sUnit) {
            return this.formatQuantity(vTime, sUnit);
        },

        formatMaterialSpec(vWeight, sWeightUnit, sBaseUnit) {
            if (vWeight === null || vWeight === undefined || vWeight === "") {
                return "-";
            }

            const sWeight = this._formatNumber(vWeight);
            const sSpecWeightUnit = this._formatWeightUnitText(sWeightUnit);
            const sSpec = sSpecWeightUnit ? `${sWeight}${sSpecWeightUnit}` : sWeight;

            return sBaseUnit ? `${sSpec}/${sBaseUnit}` : sSpec;
        },

        formatCurrencyAmount(vAmount, sCurrency) {
            if (vAmount === null || vAmount === undefined || vAmount === "") {
                return "-";
            }

            const sAmount = this._formatNumber(vAmount, {
                round: sCurrency === "KRW"
            });
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

        _formatDateTime(oDate) {
            const sHours = String(oDate.getHours()).padStart(2, "0");
            const sMinutes = String(oDate.getMinutes()).padStart(2, "0");

            return `${this._formatDateObject(oDate)} ${sHours}:${sMinutes}`;
        },

        _formatStatementPeriod(sYear, sPoper) {
            if (!sYear || !sPoper) {
                return "-";
            }

            const iMonth = Number(String(sPoper).slice(-2));

            if (!iMonth) {
                return `${sYear}년 ${sPoper}월`;
            }

            const oStartDate = new Date(Number(sYear), iMonth - 1, 1);
            const oEndDate = new Date(Number(sYear), iMonth, 0);
            const sMonth = String(iMonth).padStart(2, "0");

            return `${sYear}년 ${sMonth}월 (${this._formatDateObject(oStartDate)} ~ ${this._formatDateObject(oEndDate)})`;
        },

        _formatStatementMonth(sYear, sPoper) {
            if (!sYear || !sPoper) {
                return "산정월";
            }

            const sMonth = String(sPoper).slice(-2).padStart(2, "0");

            return `${sYear}년 ${sMonth}월`;
        },

        _formatPercent(vAmount, vTotalAmount) {
            const fTotalAmount = this._toNumber(vTotalAmount);

            if (!fTotalAmount) {
                return "0.0%";
            }

            return `${((this._toNumber(vAmount) / fTotalAmount) * 100).toFixed(1)}%`;
        },

        _formatNumber(vValue, oOptions = {}) {
            const fValue = this._toNumber(vValue);

            if (!Number.isFinite(fValue)) {
                return String(vValue);
            }

            const fDisplayValue = oOptions.round ? Math.round(fValue) : fValue;
            const iMaximumFractionDigits = oOptions.round ? 0 : 3;

            return fDisplayValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: iMaximumFractionDigits
            });
        },

        _formatCurrencyText(sCurrency) {
            if (sCurrency === "KRW") {
                return "원";
            }

            return sCurrency || "";
        },

        _formatWeightUnitText(sUnit) {
            if (String(sUnit || "").toLowerCase() === "grm") {
                return "g";
            }

            return sUnit || "";
        },

        _toNumber(vValue) {
            const fValue = Number(String(vValue ?? 0).replace(/,/g, ""));

            return Number.isFinite(fValue) ? fValue : 0;
        },

        _escapeHtml(vValue) {
            return String(vValue ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }
    });
});
