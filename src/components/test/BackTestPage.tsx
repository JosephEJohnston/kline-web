'use client';
import { useState, useEffect } from 'react';
import {KlineEngine, Bar, KlineConfig, QuantContextView} from '@/lib/KlineEngine';
import {CandlestickChart, IndicatorData} from "@/components/CandlestickChart";

export default function BacktestPage() {
    const [engine, setEngine] = useState<KlineEngine | null>(null);
    const [bars, setBars] = useState<Bar[]>([]);
    const [parsingTime, setParsingTime] = useState<number>(0);
    const [dataView, setDataView] = useState<QuantContextView | undefined>(undefined);
    // 1. 定义状态
    const [indicators, setIndicators] = useState<IndicatorData[]>([]);

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
        const ema20Array =
            engine.calculateEma(quantContext.ctxPtr, 20);
        const ema60Array =
            engine.calculateEma(quantContext.ctxPtr, 60);

        const end = performance.now();

        setDataView(quantContext);
        setParsingTime(end - start);
        setBars(bars);
        setIndicators([
            { name: 'EMA20', data: ema20Array, color: '#2962FF' },
            { name: 'EMA60', data: ema60Array, color: '#FF6D00' }
        ]);
    };

    return (
        <div className="p-10 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Zig + WASM 高性能回测引擎</h1>

            <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
            </div>

            {bars.length > 0 && (
                <div className="mt-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded shadow-sm">
                            <p className="text-gray-500 text-sm">解析行数</p>
                            <p className="text-2xl font-mono font-bold">{bars.length.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded shadow-sm">
                            <p className="text-gray-500 text-sm">WASM 耗时</p>
                            <p className="text-2xl font-mono font-bold">{parsingTime.toFixed(2)} ms</p>
                        </div>
                    </div>

                    {/* 2. 插入蜡烛图组件 */}
                    <div className="p-4 border rounded-xl bg-white shadow-sm">
                        <h2 className="text-lg font-semibold mb-4 text-gray-700">价格走势图</h2>
                        <CandlestickChart
                            dataView={dataView}
                            indicators={indicators}
                            onDataReadyToFree={handleCleanup}
                        />
                    </div>

                    <div className="border rounded overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time (Raw)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Close</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 font-mono text-sm">
                            {bars.slice(0, 5).map((bar, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-2">{bar.time.toString()}</td>
                                    <td className="px-4 py-2 text-blue-600">{bar.close.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-gray-600">{bar.volume.toFixed(0)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <p className="p-2 text-center text-xs text-gray-400">仅展示前 5 条数据</p>
                    </div>
                </div>
            )}
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