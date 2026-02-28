'use client';
import { useState, useEffect } from 'react';
import {KlineEngine, KlineConfig} from '@/lib/KlineEngine';
import {QuantContextView} from "@/lib/QuantContextView";
import DataView from "@/components/view/DataView";

export default function BacktestPage() {
    const [engine, setEngine] = useState<KlineEngine | null>(null);
    const [parsingTime, setParsingTime] = useState<number>(0);
    const [dataView, setDataView] = useState<QuantContextView | undefined>(undefined);

    // 2. 内存清理回调
    const handleCleanup = () => {
        // 当图表渲染完成并拷贝走数据后，通知 WASM 引擎重置 Arena 内存
        engine?.freeMemory();
        console.log("WASM Memory Cleaned Up");
    };

    useEffect(() => {
        KlineEngine.load().then(setEngine);
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !engine) return;

        const text = await file.text();
        const firstLineEnd = text.indexOf('\n');
        const firstLine = text.substring(0, firstLineEnd);
        if (firstLine.length < 2) return;

        // console.log('text: ' + text);

        // 1. 获取动态配置
        const config = getAutoConfig(firstLine);
        // console.log('识别到的列配置:', config);

        const start = performance.now();

        const quantContext = engine.parse(text, config);

        engine.runAnalysis(quantContext.ctxPtr);
        engine.backtestConsecutiveTrendUp(quantContext.ctxPtr, 2);

        const ema20Array =
            engine.calculateEma(quantContext.ctxPtr, 20);
        const ema60Array =
            engine.calculateEma(quantContext.ctxPtr, 60);

        const end = performance.now();

        setDataView(quantContext);
        setParsingTime(end - start);

        quantContext.setIndicators([
            { name: 'EMA20', data: ema20Array, color: '#2962FF' },
            { name: 'EMA60', data: ema60Array, color: '#FF6D00' }
        ]);
    };

    return (
        <div className="p-10 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4 text-gray-800">Zig + WASM 高性能回测引擎</h1>

            {/* 1. 文件上传区 */}
            <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
            </div>

            {/* 🌟 2. 核心逻辑：使用 dataView 进行条件渲染 */}
            <DataView
                stats={{
                    quantContext: dataView,
                    parsingTime
                }}
            />
        </div>
    );
}


// 自动识别 CSV 表头的辅助函数
const getAutoConfig = (firstLine: string): KlineConfig => {
    // 预处理：转小写并去掉空格，减少干扰
    const headers = firstLine.toLowerCase().split(',').map(h => h.trim());

    return {
        // 时间：匹配 time, date, 时间, 日期
        time_idx: headers.findIndex(h => h.includes('time') ||
            h.includes('date') ||
            h.includes('day') ||
            h.includes('时间') ||
            h.includes('日期')),

        // 开盘：匹配 open, 开盘, 或者只有字母 o
        open_idx: headers.findIndex(h => h.includes('open') || h.includes('开盘') || h === 'o'),

        // 最高：匹配 high, 最高, 或者只有字母 h
        high_idx: headers.findIndex(h => h.includes('high') || h.includes('最高') || h === 'h'),

        // 最低：匹配 low, 最低, 或者只有字母 l
        low_idx: headers.findIndex(h => h.includes('low') || h.includes('最低') || h === 'l'),

        // 收盘：匹配 close, 收盘, 或者只有字母 c
        close_idx: headers.findIndex(h => h.includes('close') || h.includes('收盘') || h === 'c'),

        // 成交量：匹配 volume, vol, 成交, 或者只有字母 v
        volume_idx: headers.findIndex(h => h.includes('vol') || h.includes('成交') || h === 'v'),
    };
};