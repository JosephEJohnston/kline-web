// 与 Zig 的 Bar struct 严格对应
import {BacktestResult} from "@/components/test/BacktestResult";
import {QuantContextView} from "@/lib/QuantContextView";
import {WasmResourceLock} from "@/components/WasmLockManager";

export interface Bar {
    time: bigint;   // i64 -> bigint
    open: number;   // f32 -> number
    high: number;
    low: number;
    close: number;
    volume: number;
    _pad: number;
}

export interface KlineConfig {
    time_idx: number;
    open_idx: number;
    high_idx: number;
    low_idx: number;
    close_idx: number;
    volume_idx: number;
}

// 这里的数字非常关键：
// i64 占 8 字节，f32 占 4 字节
// 顺序：time(0), open(8), high(12), low(16), close(20), volume(24)
// 总长度：28 字节 (如果 Zig 做了对齐补齐，可能是 32)
const BAR_SIZE = 32;

export class KlineEngine {
    private instance: WebAssembly.Instance;
    private exports: KlineWasmExports;

    constructor(instance: WebAssembly.Instance) {
        this.instance = instance;
        this.exports = instance.exports as KlineWasmExports;
    }

    static async load() {
        const response = await fetch('/wasm/kline_engine.wasm');

        // 1. 定义一个容器（引用不会变，但内容会变）
        const wasm = { instance: null as WebAssembly.Instance | null };

        const importObject = {
            env: {
                js_log_err: (ptr: number, len: number) => {
                    // 3. 这里的闭包引用的是 wasm 对象，它在函数执行时已经有值了
                    if (!wasm.instance) return;

                    const exports = wasm.instance.exports as KlineWasmExports;
                    const memory = new Uint8Array(exports.memory.buffer);
                    const bytes = memory.subarray(ptr, ptr + len);
                    const msg = new TextDecoder().decode(bytes);

                    console.warn("🛡️ [Zig Debug]:", msg);
                }
            }
        };

        const { instance } = await WebAssembly.instantiateStreaming(response, importObject);

        // 2. 填充容器
        wasm.instance = instance;

        return new KlineEngine(instance);
    }

    public freeMemory() {
        this.exports.free_memory();
    }

    public parse(csvText: string, config: KlineConfig, manager: WasmResourceLock): QuantContextView {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvText);
        const len = bytes.length;

        // 1. 申请内存并拷贝数据 (与之前一致)
        const ptr = this.exports.alloc_memory(len);
        new Uint8Array(this.exports.memory.buffer).set(bytes, ptr);

        // 2. 解析并获取 QuantContext 结构体的指针
        const ctxPtr = this.exports.parse_csv_wasm(
            ptr,
            len,
            config.time_idx,
            config.open_idx,
            config.high_idx,
            config.low_idx,
            config.close_idx,
            config.volume_idx
        );

        return new QuantContextView(this.exports.memory, ctxPtr, manager);
    }

    /**
     * 计算 EMA 指标（平行数组版）
     * @param ctxPtr
     * @param period 均线周期 (如 20)
     * @returns 包含 EMA 值的 Float32Array
     */
    public calculateEma(ctxPtr: number, period: number): Float32Array {
        const view = new DataView(this.exports.memory.buffer);

        // 1. 从 QuantContext 结构体中读取 count (offset 为 28)
        // 这样保证了 TS 分配的大小与 Zig 解析出的数量严格对齐
        const count = view.getUint32(ctxPtr + 28, true);

        if (count === 0) return new Float32Array(0);

        // 2. 申请存放计算结果的内存 (f32 占用 4 字节)
        // 直接复用你之前写的 alloc_memory
        const outputPtr = this.exports.alloc_memory(count * 4);

        // 3. 调用 Zig 导出的计算函数 (🌟 只有 3 个参数)
        // 签名: (ctxPtr, period, outputPtr)
        this.exports.calculate_ema(ctxPtr, period, outputPtr);

        // 4. “零拷贝”映射内存视图
        const emaResultView = new Float32Array(
            this.exports.memory.buffer,
            outputPtr,
            count
        );

        // 🌟 核心建议：返回一个拷贝
        // 因为你的 ArenaAllocator 可能在下一次 free_memory() 时把这块内存刷掉
        // 如果是用于 React 渲染，建议直接 slice() 出来
        return emaResultView.slice();
    }

    /**
     * 执行价格行为分析 (Price Action Analysis)
     * 调用后，QuantContextView 中的 attributes 数组将被填充 Trend Bar 和 Inside Bar 等标签
     * @param ctxPtr QuantContext 的内存指针
     */
    public runAnalysis(ctxPtr: number): void {
        // 检查指针有效性
        if (ctxPtr === 0) {
            console.warn("⚠️ [KlineEngine]: 尝试在空指针上执行 runAnalysis");
            return;
        }

        // 调用 Zig 导出的 run_analysis
        // 它会利用 SIMD 批量计算并更新 attributes 内存区域
        this.exports.run_analysis(ctxPtr);
    }

    /**
     * 执行连续强趋势条策略回测
     * @param ctxPtr QuantContext 指针
     * @param n 触发信号所需的连续趋势条数量
     * @returns 包含完整交易记录和统计指标的 BacktestResult 对象
     */
    public backtestConsecutiveTrendUp(ctxPtr: number, n: number): BacktestResult | null {
        // 1. 调用 Zig 导出的回测函数，获取描述符指针
        // 此时 Zig 侧已经在 Arena 上分配好了所有交易数组和 Descriptor 结构体
        const descriptorPtr = this.exports.backtest_consecutive_trend_up(ctxPtr, n);

        // 2. 检查空指针（虽然 Zig 侧做了 catch，但前端防御必不可少）
        if (descriptorPtr === 0) {
            console.error("❌ [KlineEngine]: 回测执行失败，WASM 返回空指针");
            return null;
        }

        // 3. 将指针封装为映射对象并返回
        // 所有的内存读取都在构造函数中通过偏移量自动完成
        return new BacktestResult(this.exports.memory, descriptorPtr);
    }
}
