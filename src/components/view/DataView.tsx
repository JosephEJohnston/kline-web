'use client'
import React from 'react';
import {CandlestickChart} from "@/components/CandlestickChart";
import {QuantContextView} from "@/lib/QuantContextView";
import {BacktestResult} from "@/components/test/BacktestResult";


interface BacktestStats {
    quantContext?: QuantContextView;
    parsingTime: number;
    backtestResult?: BacktestResult | null; // 🌟 新增：接收回测结果
}

interface DataViewProps {
    stats: BacktestStats;
}

const DataView = ({ stats }: DataViewProps) => {
    const {
        quantContext: dataView,
        parsingTime,
        backtestResult
    } = stats;

    return (
        <>
            {dataView && dataView.count > 0 && (
                <div className="mt-8 space-y-4 animate-in fade-in duration-500">
                    {/* 性能看板 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm">
                            <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider">解析行数 (Actual)</p>
                            <p className="text-2xl font-mono font-bold text-blue-900">{dataView.count.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-green-50 border border-green-100 rounded-xl shadow-sm">
                            <p className="text-green-600 text-xs font-semibold uppercase tracking-wider">WASM 引擎耗时</p>
                            <p className="text-2xl font-mono font-bold text-green-900">{parsingTime.toFixed(3)} ms</p>
                        </div>
                    </div>

                    {/* 3. 价格走势图组件 */}
                    <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-700">实时 K 线图 (EMA20 系统)</h2>
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">WASM 零拷贝渲染</span>
                        </div>
                        <CandlestickChart
                            dataView={dataView}
                            backtestResult={backtestResult}
                        />
                    </div>

                    {/* 4. 数据预览表格：直接从 TypedArray 读取，不创建中间对象 */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">Index</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">Time (Unix)</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">Close</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">Volume</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100 font-mono text-sm">
                            {/* 🌟 关键：手动索引读取，避免 bars.slice().map() 产生的大量临时对象 */}
                            {Array.from({ length: Math.min(dataView.count, 5) }).map((_, i) => (
                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-2 text-gray-400 text-xs">#{i}</td>
                                    <td className="px-4 py-2 text-gray-700">{dataView.times[i].toString()}</td>
                                    <td className="px-4 py-2 text-blue-600 font-bold">{dataView.closes[i].toFixed(2)}</td>
                                    <td className="px-4 py-2 text-gray-500">{dataView.volumes[i].toFixed(0)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        <div className="p-3 bg-gray-50 text-center text-xs text-gray-400 italic">
                            直接映射 WASM 线性内存地址 · 仅展示前 5 条采样
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DataView;