/**
 * 对应 Zig 端导出的 WASM 函数接口
 */
interface KlineWasmExports extends WebAssembly.Exports {
    /**
     * WASM 线性内存对象，JS 通过它读写二进制数据
     */
    memory: WebAssembly.Memory;

    /**
     * 在 WASM Arena 中申请内存
     * @param len 需要申请的字节长度
     * @returns 内存起始地址（指针）
     */
    alloc_memory(len: number): number;

    /**
     * 解析 CSV 字符串
     */
    parse_csv_wasm(
        ptr: number,
        len: number,
        time_idx: number,
        open_idx: number,
        high_idx: number,
        low_idx: number,
        close_idx: number,
        volume_idx: number
    ): number;

    /**
     * 获取最近一次解析出的 Bar 数量
     */
    get_last_parse_count(): number;

    /**
     * 释放/重置整个 Arena 分配器
     */
    free_memory(): void;
}
