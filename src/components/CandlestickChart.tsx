'use client';

import React, {useEffect, useRef} from 'react';
import {
    createChart,
    ColorType,
    IChartApi,
    ISeriesApi,
    CandlestickSeries,
    UTCTimestamp,
    LineSeries, LineStyle, Time,
    WhitespaceData,
    LineSeriesOptions,
    LineData, DeepPartial, LineStyleOptions, SeriesOptionsCommon
} from 'lightweight-charts';
import {Bar} from '@/lib/KlineEngine'; // 引入你定义的 Bar 接口

export interface IndicatorData {
    name: string;         // 如 "EMA20"
    data: Float32Array;   // 从 WASM 直接映射出来的平行数组
    color?: string;       // 该均线的渲染颜色
}

interface CandlestickChartProps {
    bars: Bar[];
    // 平行指标数组集合
    indicators?: IndicatorData[];
    // 🌟 关键：数据同步完成的回调
    // 当图表库（如 lightweight-charts）完成 setData 拷贝后触发
    onDataReadyToFree?: () => void;
    colors?: {
        backgroundColor?: string;
        lineColor?: string;
        textColor?: string;
        areaTopColor?: string;
        areaBottomColor?: string;
    };
}

export const CandlestickChart: React.FC<CandlestickChartProps> = (props) => {
    const {
        bars,
        indicators,
        onDataReadyToFree,
        colors: {
            backgroundColor = 'white',
            textColor = 'black',
        } = {},
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null!);
    const chartRef = useRef<IChartApi>(null!);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    // 🌟 关键：使用 Map 管理动态生成的指标线
    // Key 为指标名称 (如 "EMA20")，Value 为图表库的 Series 实例
    const indicatorSeriesMap = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 1. 创建图表实例
        const handleResize = () => {
            chart.applyOptions({width: chartContainerRef.current!.clientWidth});
        };

        const chart = makeChart(chartContainerRef, backgroundColor, textColor);

        chartRef.current = chart;

        // 2. 添加 K 线系列
        const newSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a', // 涨的颜色
            downColor: '#ef5350', // 跌的颜色
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        seriesRef.current = newSeries;

        // 3. 监听窗口大小变化
        window.addEventListener('resize', handleResize);

        // 4. 清理函数：组件卸载时销毁图表
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [backgroundColor, textColor]);

    // 5. 当数据变化时，更新图表数据
    useEffect(() => {
        if (!seriesRef.current || bars.length === 0) return;
        const chart = chartRef.current;

        const chartData = bars.map(bar => ({
            time: Number(bar.time) as UTCTimestamp, // 将纳秒转为秒
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        }));
        seriesRef.current.setData(chartData);

        handleIndicator(bars, chart, indicatorSeriesMap, indicators);

        // 3. 🌟 数据已安全进入图表库，通知外部释放 WASM 内存
        if (onDataReadyToFree) {
            onDataReadyToFree();
        }

        // 自动缩放以显示所有数据
        chartRef.current?.timeScale().fitContent();

    }, [bars, indicators, onDataReadyToFree]);

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

function handleIndicator(
    bars: Bar[],
    chart: IChartApi,
    indicatorSeriesMap: React.RefObject<Map<string, ISeriesApi<"Line", Time, WhitespaceData<Time> | LineData<Time>, LineSeriesOptions, DeepPartial<LineStyleOptions & SeriesOptionsCommon>>>>,
    indicators?: IndicatorData[],
) {
    // B. 同步平行指标数组
    if (!indicators) {
        return;
    }

    indicators.forEach(ind => {
        // 如果该指标线还不存在，则创建它
        if (indicatorSeriesMap.current.has(ind.name)) {
            return;
        }

        const newLine = chart.addSeries(LineSeries, {
            color: ind.color || '#2962FF',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            title: ind.name,
        });
        indicatorSeriesMap.current.set(ind.name, newLine);

        // 转换平行数组为图表格式
        const lineData = [];
        for (let i = 0; i < ind.data.length; i++) {
            const val = ind.data[i];
            if (val <= 0) { // 过滤掉初始周期的 0 值
                continue;
            }
            const dot = {
                time: Number(bars[i].time) as UTCTimestamp,
                value: val,
            }
            lineData.push(dot);
        }
        indicatorSeriesMap.current.get(ind.name)?.setData(lineData);
    });

    // 清理掉不再存在的指标轨道
    /*const currentNames = new Set(indicators.map(i => i.name));
    indicatorSeriesMap.current.forEach((series, name) => {
        if (currentNames.has(name)) {
            return;
        }

        chart.removeSeries(series);
        indicatorSeriesMap.current.delete(name);
    });*/
}