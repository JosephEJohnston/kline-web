// 与 Zig 的 Bar struct 严格对应
export interface Bar {
    time: bigint;   // i64 -> bigint
    open: number;   // f32 -> number
    high: number;
    low: number;
    close: number;
    volume: number;
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
const BAR_SIZE = 28;

export class KlineEngine {
    private instance: WebAssembly.Instance;
    private exports: KlineWasmExports;

    constructor(instance: WebAssembly.Instance) {
        this.instance = instance;
        this.exports = instance.exports as KlineWasmExports;
    }

    static async load() {
        const response = await fetch('/wasm/kline_engine.wasm');
        const { instance } = await WebAssembly.instantiateStreaming(response);
        return new KlineEngine(instance);
    }

    parse(csvText: string, config: KlineConfig): Bar[] {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvText);
        const len = bytes.length;

        // 1. 在 WASM 内存里申请地盘
        const ptr = this.exports.alloc_memory(len);

        // 2. 将 JS 数据拷贝进 WASM 内存
        const wasmMemory = new Uint8Array(this.exports.memory.buffer);
        wasmMemory.set(bytes, ptr);

        // 3. 调用 Zig 的解析函数
        const barsPtr = this.exports.parse_csv_wasm(
            ptr,
            len,
            config.time_idx,
            config.open_idx,
            config.high_idx,
            config.low_idx,
            config.close_idx,
            config.volume_idx
        );
        const count = this.exports.get_last_parse_count();

        // 4. 从二进制内存中读取 Bar 数组
        const bars: Bar[] = [];
        const view = new DataView(this.exports.memory.buffer);

        for (let i = 0; i < count; i++) {
            const offset = barsPtr + (i * BAR_SIZE);
            bars.push({
                // DataView 默认是大端序，但 WASM 是小端序 (Little Endian)，所以第三个参数传 true
                time: view.getBigInt64(offset + 0, true),
                open: view.getFloat32(offset + 8, true),
                high: view.getFloat32(offset + 12, true),
                low: view.getFloat32(offset + 16, true),
                close: view.getFloat32(offset + 20, true),
                volume: view.getFloat32(offset + 24, true),
            });
        }

        // 5. 【关键】用完后让 Arena 重置内存
        this.exports.free_memory();

        return bars;
    }
}
