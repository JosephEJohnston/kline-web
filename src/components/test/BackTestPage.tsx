'use client';
import { useState, useEffect } from 'react';
import { KlineEngine, Bar } from '@/lib/KlineEngine';

export default function BacktestPage() {
    const [engine, setEngine] = useState<KlineEngine | null>(null);
    const [data, setData] = useState<Bar[]>([]);

    useEffect(() => {
        KlineEngine.load().then(setEngine);
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !engine) return;

        const text = await file.text();

        console.time('ZigParsing');
        const result = engine.parse(text);
        console.timeEnd('ZigParsing'); // 你会在这里看到惊人的 0.01s 左右的耗时

        setData(result);
    };

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">高性能回测引擎</h1>
            <input type="file" onChange={handleFileUpload} accept=".csv" />
            <div className="mt-4">
                解析行数: {data.length}
                {data.length > 0 && (
                    <div className="text-sm text-gray-500">
                        第一根 K 线收盘价: {data[0].close}
                    </div>
                )}
            </div>
        </div>
    );
}
