export class BacktestResult {
    // --- 私有内存引用与元数据 ---
    private memory: WebAssembly.Memory;
    private readonly descriptorPtr: number;

    constructor(wasmMemory: WebAssembly.Memory, descriptorPtr: number) {
        this.memory = wasmMemory;
        this.descriptorPtr = descriptorPtr;
    }

    // --- 核心 Getter：实时从当前内存缓冲区读取数据 ---

    private get view(): DataView {
        // 每次访问都获取最新的 buffer，防御 memory.grow()
        return new DataView(this.memory.buffer);
    }

    // --- 统计指标 (按 4 字节偏移量读取) ---

    public get count(): number {
        return this.view.getUint32(this.descriptorPtr + 20, true);
    }

    public get capacity(): number {
        return this.view.getUint32(this.descriptorPtr + 24, true);
    }

    public get winCount(): number {
        return this.view.getUint32(this.descriptorPtr + 28, true);
    }

    public get totalProfit(): number {
        return this.view.getFloat32(this.descriptorPtr + 32, true);
    }

    public get maxDrawdown(): number {
        return this.view.getFloat32(this.descriptorPtr + 36, true);
    }

    public get winRate(): number {
        const c = this.count;
        return c > 0 ? this.winCount / c : 0;
    }

    // --- 零拷贝数组映射 (每次访问重新绑定最新 Buffer) ---

    public get entryIndices(): Uint32Array {
        const ptr = this.view.getUint32(this.descriptorPtr + 0, true);
        return new Uint32Array(this.memory.buffer, ptr, this.count);
    }

    public get exitIndices(): Uint32Array {
        const ptr = this.view.getUint32(this.descriptorPtr + 4, true);
        return new Uint32Array(this.memory.buffer, ptr, this.count);
    }

    public get entryPrices(): Float32Array {
        const ptr = this.view.getUint32(this.descriptorPtr + 8, true);
        return new Float32Array(this.memory.buffer, ptr, this.count);
    }

    public get exitPrices(): Float32Array {
        const ptr = this.view.getUint32(this.descriptorPtr + 12, true);
        return new Float32Array(this.memory.buffer, ptr, this.count);
    }

    public get profits(): Float32Array {
        const ptr = this.view.getUint32(this.descriptorPtr + 16, true);
        return new Float32Array(this.memory.buffer, ptr, this.count);
    }

    /**
     * 获取动态生成的资金曲线 (基于最新 profits)
     */
    public getEquityCurve(): Float32Array {
        const c = this.count;
        const p = this.profits;
        const curve = new Float32Array(c);
        let runningSum = 0;
        for (let i = 0; i < c; i++) {
            runningSum += p[i];
            curve[i] = runningSum;
        }
        return curve;
    }
}