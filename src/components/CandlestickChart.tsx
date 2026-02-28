'use client';

import React, {useEffect, useRef} from 'react';
import {
    CandlestickSeries,
    ColorType,
    createChart, createSeriesMarkers,
    IChartApi,
    ISeriesApi, ISeriesMarkersPluginApi,
    LineSeries,
    LineStyle, SeriesMarker, Time,
    UTCTimestamp,
} from 'lightweight-charts';
import {QuantContextView} from "@/lib/QuantContextView";
import {useWasmLock} from "@/components/WasmLockManager";
import {BacktestResult} from "@/components/test/BacktestResult";

export interface IndicatorData {
    name: string;         // 如 "EMA20"
    data: Float32Array;   // 从 WASM 直接映射出来的平行数组
    color?: string;       // 该均线的渲染颜色
}

interface CandlestickChartProps {
    dataView?: QuantContextView;
    // 🌟 关键：数据同步完成的回调
    // 当图表库（如 lightweight-charts）完成 setData 拷贝后触发
    backtestResult?: BacktestResult | null; // 🌟 新增：接收回测结果
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}

type ChartCandlestickSeries = ISeriesApi<"Candlestick">;
type ChartIndicatorLine = ISeriesApi<"Line">;

export const CandlestickChart: React.FC<CandlestickChartProps> = (props) => {
    const {
        dataView,
        backtestResult,
        colors: {
            backgroundColor = 'white',
            textColor = 'black',
        } = {},
    } = props;

    useWasmLock("CandlestickChart");

    const chartContainerRef = useRef<HTMLDivElement>(null!);
    const chartRef = useRef<IChartApi>(null!);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    // 🌟 关键：使用 Map 管理动态生成的指标线
    // Key 为指标名称 (如 "EMA20")，Value 为图表库的 Series 实例
    const indicatorSeriesMap = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
    const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp>>(null); // 保存标记插件实例

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 1. 创建图表实例
        const handleResize = () => {
            chart.applyOptions({width: chartContainerRef.current!.clientWidth});
        };

        const chart = makeChart(chartContainerRef, backgroundColor, textColor);
        chartRef.current = chart;

        // 2. 添加 K 线系列
        seriesRef.current = makeBar(chart);

        // 3. 监听窗口大小变化
        window.addEventListener('resize', handleResize);

        const mapCurrent =
            indicatorSeriesMap.current;
        
        // 4. 清理函数：组件卸载时销毁图表
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            // 🌟 关键：销毁图表时必须清空 Map 注册表
            mapCurrent.clear();
        };
    }, [backgroundColor, textColor]);

    // 5. 当数据变化时，更新图表数据
    useEffect(() => {
        if (!dataView || dataView.count === 0) return;

        const { times, opens, highs, lows, closes, count } = dataView;
        if (!seriesRef.current || count === 0) return;
        const chart = chartRef.current;

        const chartData = new Array(count);
        for (let i = 0; i < count; i++) {
            chartData[i] = {
                // 注意：如果你的 Zig 解析的是 Unix 秒，直接转换；如果是毫秒/纳秒，需处理精度
                time: Number(times[i]) as UTCTimestamp,
                open: opens[i],
                high: highs[i],
                low: lows[i],
                close: closes[i],
            };
        }
        seriesRef.current.setData(chartData);

        handleIndicator(dataView, chart, indicatorSeriesMap, dataView.indicators);

        // 自动缩放以显示所有数据
        chartRef.current?.timeScale().fitContent();

    }, [dataView, dataView?.indicators]);

    useEffect(() => {
        if (!dataView || !seriesRef.current) return;

        // 🌟 1. 处理标记逻辑
        if (backtestResult && backtestResult.count > 0) {
            const markers: SeriesMarker<UTCTimestamp>[] = [] // 初始为空
            const { entryIndices, exitIndices, entryPrices, exitPrices } = backtestResult;
            const { times } = dataView!;

            for (let i = 0; i < backtestResult.count; i++) {
                // 🌟 这里的 push 操作就是让数组“不为空”的关键
                // 入场信号
                markers.push({
                    time: Number(times[entryIndices[i]]) as UTCTimestamp,
                    position: 'belowBar',
                    color: '#26a69a',
                    shape: 'arrowUp',
                    text: `买入 @ ${entryPrices[i].toFixed(2)}`,
                });

                // 出场信号
                markers.push({
                    time: Number(times[exitIndices[i]]) as UTCTimestamp,
                    position: 'aboveBar',
                    color: '#ef5350',
                    shape: 'arrowDown',
                    text: `卖出 @ ${exitPrices[i].toFixed(2)}`,
                });
            }

            // 最后排序并交付给图表
            markers.sort((a, b) => (a.time as number) - (b.time as number));
            // 🌟 3. 调用实例上的 setMarkers 方法
            markersRef.current?.setMarkers(markers);

        } else {
            // 清空标记
            markersRef.current?.setMarkers([]);
        }
    }, [dataView, backtestResult]);

    return <div ref={chartContainerRef} className="w-full relative"/>;
};

function makeChart(
    chartContainerRef: React.RefObject<HTMLDivElement>,
    backgroundColor: string,
    textColor: string
): IChartApi {
    return createChart(chartContainerRef.current, {
        layout: {
            background: {type: ColorType.Solid, color: backgroundColor},
            textColor,
        },
        width: chartContainerRef.current.clientWidth,
        height: 500, // 你可以根据需要调整高度
        grid: {
            vertLines: {color: '#f0f3fa'},
            horzLines: {color: '#f0f3fa'},
        },
        timeScale: {
            borderColor: '#f0f3fa',
            timeVisible: true, // 显示具体时间
        },
    });
}

function makeBar(
    chart: IChartApi,
): ChartCandlestickSeries {
    return chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a', // 涨的颜色
        downColor: '#ef5350', // 跌的颜色
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });;
}

function handleIndicator(
    dataView: QuantContextView,
    chart: IChartApi,
    indicatorSeriesMap: React.RefObject<Map<string, ChartIndicatorLine>>,
    indicators: IndicatorData[],
) {
    const { times, count } = dataView;
    // 第一步：清理已失效的线
    const activeNames = new Set(indicators.map(i => i.name));
    indicatorSeriesMap.current.forEach((series, name) => {
        if (!activeNames.has(name)) {
            chart.removeSeries(series);
            indicatorSeriesMap.current.delete(name);
        }
    });

    indicators.forEach(ind => {
        // 如果该指标线还不存在，则创建它
        let lineSeries =
            indicatorSeriesMap.current.get(ind.name);

        if (!lineSeries) {
            lineSeries = chart.addSeries(LineSeries, {
                color: ind.color, // 设置为橙色，显眼一点
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                title: ind.name, // 图例标题
            });
        }

        // 转换平行数组为图表格式
        const lineData = [];
        for (let i = 0; i < ind.data.length; i++) {
            const val = ind.data[i];
            if (val <= 0 || isNaN(val)) { // 过滤掉初始周期的 0 值
                continue;
            }
            const dot = {
                time: Number(times[i]) as UTCTimestamp,
                value: val,
            }
            lineData.push(dot);
        }
        lineSeries.setData(lineData);

        indicatorSeriesMap.current.set(ind.name, lineSeries);
    });
}

