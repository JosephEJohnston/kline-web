import React from 'react';
import {BacktestResult} from "@/components/test/BacktestResult";

interface Props {
    result?: BacktestResult | null;
}

export default function BacktestResultView({ result }: Props) {
    if (!result || result.count === 0) return null;

    // 🌟 利用你定义的 Getter 实时读取数据
    const stats = [
        { label: "交易总数", value: result.count, color: "text-gray-900" },
        { label: "胜率", value: `${(result.winRate * 100).toFixed(2)}%`, color: "text-blue-600" },
        { label: "总盈亏", value: result.totalProfit.toFixed(2), color: result.totalProfit >= 0 ? "text-green-600" : "text-red-600" },
        { label: "最大回撤", value: result.maxDrawdown.toFixed(2), color: "text-red-500" },
    ];

    return (
        <div className="grid grid-cols-4 gap-4 mt-6">
            {stats.map((item, i) => (
                <div key={i} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                    <p className="text-gray-400 text-xs font-medium uppercase">{item.label}</p>
                    <p className={`text-xl font-mono font-bold mt-1 ${item.color}`}>
                        {item.value}
                    </p>
                </div>
            ))}
        </div>
    );
}
