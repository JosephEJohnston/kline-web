export class BacktestResult {
    // --- 统计指标 ---
    public readonly count: number;
    public readonly capacity: number;
    public readonly winCount: number;
    public readonly totalProfit: number;
    public readonly maxDrawdown: number;
    public readonly winRate: number;

    // --- 零拷贝数据视图 (TypedArrays) ---
    public readonly entryIndices: Uint32Array;
    public readonly exitIndices: Uint32Array;
    public readonly entryPrices: Float32Array;
    public readonly exitPrices: Float32Array;
    public readonly profits: Float32Array;

    constructor(wasmMemory: WebAssembly.Memory, descriptorPtr: number) {
        const buffer = wasmMemory.buffer;
        const view = new DataView(buffer);

        // 🌟 1. 读取基础计数与指标 (严格匹配 Zig extern struct 顺序)
        // 偏移量 20, 24, 28, 32, 36
        this.count = view.getUint32(descriptorPtr + 20, true);
        this.capacity = view.getUint32(descriptorPtr + 24, true);
        this.winCount = view.getUint32(descriptorPtr + 28, true);
        this.totalProfit = view.getFloat32(descriptorPtr + 32, true);
        this.maxDrawdown = view.getFloat32(descriptorPtr + 36, true);

        // 派生指标
        this.winRate = this.count > 0 ? this.winCount / this.count : 0;

        // 🌟 2. 映射指针为 TypedArray (偏移量 0, 4, 8, 12, 16)
        const pEntryIdx = view.getUint32(descriptorPtr + 0, true);
        const pExitIdx  = view.getUint32(descriptorPtr + 4, true);
        const pEntryPri = view.getUint32(descriptorPtr + 8, true);
        const pExitPri  = view.getUint32(descriptorPtr + 12, true);
        const pProfits  = view.getUint32(descriptorPtr + 16, true);

        this.entryIndices = new Uint32Array(buffer, pEntryIdx, this.count);
        this.exitIndices  = new Uint32Array(buffer, pExitIdx, this.count);
        this.entryPrices  = new Float32Array(buffer, pEntryPri, this.count);
        this.exitPrices   = new Float32Array(buffer, pExitPri, this.count);
        this.profits      = new Float32Array(buffer, pProfits, this.count);
    }

    /**
     * 辅助方法：获取简单的资金曲线数据
     */
    public getEquityCurve(): Float32Array {
        const curve = new Float32Array(this.count);
        let runningSum = 0;
        for (let i = 0; i < this.count; i++) {
            runningSum += this.profits[i];
            curve[i] = runningSum;
        }
        return curve;
    }
}
