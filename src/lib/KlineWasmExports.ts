/**
 * WASM 导出的原始函数签名
 */
interface KlineWasmExports extends WebAssembly.Exports {
    memory: WebAssembly.Memory;

    /** 申请 len 字节内存，返回首地址 */
    alloc_memory(len: number): number;

    /** 重置 WASM Arena 内存池 */
    free_memory(): void;

    /** 解析 CSV 返回 QuantContext 指针 */
    parse_csv_wasm(ptr: number, len: number, ...indices: number[]): number;

    /** 获取 K 线总笔数 */
    get_last_parse_count(): number;

    /** 执行 PA 属性提取分析 */
    run_analysis(ctxPtr: number): void;

    /** 计算 EMA 指标 */
    calculate_ema(ctxPtr: number, period: number, outputPtr: number): void;

    /** 🌟 执行回测并返回结果描述符地址 */
    backtest_consecutive_trend_up(ctxPtr: number, n: number): number;
}
