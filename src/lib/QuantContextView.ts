import {IndicatorData} from "@/components/CandlestickChart";
import {WasmResourceLock} from "@/components/WasmLockManager";

/**
 * 对应 QuantContext 在 WASM 内存中的结构布局
 */
export class QuantContextView {
    // --- 私有内存引用 ---
    private memory: WebAssembly.Memory;
    public readonly lock: WasmResourceLock; // 🌟 新增锁引用
    private readonly _ctxPtr: number;
    private readonly _count: number;

    // --- 各个数组的起始指针 (偏移量) ---
    private readonly timePtr: number;
    private readonly openPtr: number;
    private readonly highPtr: number;
    private readonly lowPtr: number;
    private readonly closePtr: number;
    private readonly volumePtr: number;
    private readonly attrPtr: number;

    private _indicators: IndicatorData[] = []; // 新增字段

    constructor(wasmMemory: WebAssembly.Memory, ctxPtr: number, lock: WasmResourceLock) {
        this.memory = wasmMemory;
        this._ctxPtr = ctxPtr;
        this.lock = lock; // 绑定该视图专用的锁

        const view = new DataView(this.memory.buffer);

        // 1. 从 QuantContext 结构体中解析出所有内部指针 (WASM32 步长为 4)
        this.timePtr   = view.getUint32(ctxPtr + 0,  true);
        this.openPtr   = view.getUint32(ctxPtr + 4,  true);
        this.highPtr   = view.getUint32(ctxPtr + 8,  true);
        this.lowPtr    = view.getUint32(ctxPtr + 12, true);
        this.closePtr  = view.getUint32(ctxPtr + 16, true);
        this.volumePtr = view.getUint32(ctxPtr + 20, true);
        this.attrPtr   = view.getUint32(ctxPtr + 24, true);

        // 2. 获取总行数 (Offset 28)
        this._count    = view.getUint32(ctxPtr + 28, true);
    }

    // --- 公开 Getter：每次访问都基于最新的 buffer 重新创建视图 ---

    public get times(): BigInt64Array {
        return new BigInt64Array(this.memory.buffer, this.timePtr, this._count);
    }

    public get opens(): Float32Array {
        return new Float32Array(this.memory.buffer, this.openPtr, this._count);
    }

    public get highs(): Float32Array {
        return new Float32Array(this.memory.buffer, this.highPtr, this._count);
    }

    public get lows(): Float32Array {
        return new Float32Array(this.memory.buffer, this.lowPtr, this._count);
    }

    public get closes(): Float32Array {
        return new Float32Array(this.memory.buffer, this.closePtr, this._count);
    }

    public get volumes(): Float32Array {
        return new Float32Array(this.memory.buffer, this.volumePtr, this._count);
    }

    public get attributes(): Uint8Array {
        return new Uint8Array(this.memory.buffer, this.attrPtr, this._count);
    }

    public get count(): number {
        return this._count;
    }

    public get ctxPtr(): number {
        return this._ctxPtr;
    }

    public setIndicators(data: IndicatorData[]) {
        this._indicators = data;
    }

    public get indicators(): IndicatorData[] {
        return this._indicators;
    }
}

