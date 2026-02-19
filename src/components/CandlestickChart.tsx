'use client';

import React, { useEffect, useRef } from 'react';
import {createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, UTCTimestamp} from 'lightweight-charts';
import { Bar } from '@/lib/KlineEngine'; // 引入你定义的 Bar 接口

interface CandlestickChartProps {
    data: Bar[];
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
        data,
        colors: {
            backgroundColor = 'white',
            lineColor = '#2962FF',
            textColor = 'black',
            areaTopColor = '#2962FF',
            areaBottomColor = 'rgba(41, 98, 255, 0.28)',
        } = {},
    } = props;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 1. 创建图表实例
        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: 500, // 你可以根据需要调整高度
            grid: {
                vertLines: { color: '#f0f3fa' },
                horzLines: { color: '#f0f3fa' },
            },
            timeScale: {
                borderColor: '#f0f3fa',
                timeVisible: true, // 显示具体时间
            },
        });

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
        if (!seriesRef.current || data.length === 0) return;

        // 【关键】数据格式转换
        // Lightweight Charts 需要的时间戳是秒（Number 类型）
        // 你的 WASM 解析出来的是纳秒（BigInt 类型）
        const chartData = data.map(bar => ({
            time: Number(bar.time) as UTCTimestamp, // 将纳秒转为秒
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        }));

        seriesRef.current.setData(chartData);

        // 自动缩放以显示所有数据
        chartRef.current?.timeScale().fitContent();

    }, [data]);

    return <div ref={chartContainerRef} className="w-full relative" />;
};